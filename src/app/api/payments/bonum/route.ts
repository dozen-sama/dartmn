import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

// Bonum Gateway integration
// Гэрээ байгуулсны дараа .env.local-д нэмнэ:
// BONUM_MERCHANT_ID=...
// BONUM_TERMINAL_ID=...
// BONUM_SECRET_KEY=...
// BONUM_API_URL=https://api.bonum.mn (жишээ)

const BONUM_API_URL = process.env.BONUM_API_URL ?? ""
const MERCHANT_ID = process.env.BONUM_MERCHANT_ID ?? ""
const TERMINAL_ID = process.env.BONUM_TERMINAL_ID ?? ""
const SECRET_KEY = process.env.BONUM_SECRET_KEY ?? ""

function generateSignature(data: Record<string, string>): string {
  const sorted = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join("&")
  return crypto.createHmac("sha256", SECRET_KEY).update(sorted).digest("hex")
}

export async function POST(req: NextRequest) {
  if (!MERCHANT_ID || !SECRET_KEY) {
    return NextResponse.json(
      { error: "Bonum Gateway тохируулагдаагүй байна. .env.local-д BONUM_* keys нэмнэ үү." },
      { status: 503 }
    )
  }

  const { tournament_id, player_id, amount, description } = await req.json()
  if (!tournament_id || !player_id || !amount) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Transaction үүсгэх
  const { data: txn, error: txnErr } = await supabase
    .from("payment_transactions")
    .insert({
      player_id,
      tournament_id,
      amount,
      currency: "MNT",
      provider: "qpay", // TODO: "bonum" нэмнэ
      status: "pending",
    })
    .select("id")
    .single()

  if (txnErr || !txn) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  const orderId = txn.id

  // Bonum invoice request (API байгуулагдсны дараа)
  const payload = {
    merchant_id: MERCHANT_ID,
    terminal_id: TERMINAL_ID,
    order_id: orderId,
    amount: String(amount),
    currency: "MNT",
    description: description ?? `DartMN тэмцээний хураамж`,
    callback_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bonum-callback`,
    return_url: `${process.env.NEXTAUTH_URL ?? ""}/tournaments/${tournament_id}`,
  }

  const signature = generateSignature(payload as Record<string, string>)

  try {
    const res = await fetch(`${BONUM_API_URL}/invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.invoice_id) {
      await supabase
        .from("payment_transactions")
        .update({ invoice_id: data.invoice_id, qr_text: data.qr_text ?? null })
        .eq("id", orderId)

      return NextResponse.json({
        transaction_id: orderId,
        invoice_id: data.invoice_id,
        qr_text: data.qr_text,
        payment_url: data.payment_url,
      })
    }

    return NextResponse.json({ error: "Bonum invoice failed", details: data }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: "Bonum API cold" }, { status: 502 })
  }
}

// Callback — Bonum-с webhook
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { order_id, status, signature: reqSig } = body

  // Signature шалгах
  const checkData = { order_id, status }
  const expectedSig = generateSignature(checkData as Record<string, string>)
  if (reqSig !== expectedSig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  if (status === "SUCCESS" || status === "PAID") {
    const supabase = await createAdminClient()
    await supabase
      .from("payment_transactions")
      .update({ status: "paid" })
      .eq("id", order_id)

    // Tournament registration payment confirm
    const { data: txn } = await supabase
      .from("payment_transactions")
      .select("player_id, tournament_id")
      .eq("id", order_id)
      .single()

    if (txn?.tournament_id) {
      await supabase
        .from("tournament_registrations")
        .update({ payment_status: "paid", payment_id: order_id })
        .eq("tournament_id", txn.tournament_id)
        .eq("player_id", txn.player_id)
    }
  }

  return NextResponse.json({ ok: true })
}
