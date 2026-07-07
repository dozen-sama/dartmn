import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { resolveExpectedAmount } from "@/lib/payments/validate-amount"

const QPAY_BASE = "https://merchant.qpay.mn/v2"

async function getQPayToken(): Promise<string> {
  const res = await fetch(`${QPAY_BASE}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${process.env.QPAY_CLIENT_ID}:${process.env.QPAY_CLIENT_SECRET}`).toString("base64")}`,
    },
  })
  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  if (!process.env.QPAY_CLIENT_ID || process.env.QPAY_CLIENT_ID === "your_qpay_client_id") {
    return NextResponse.json({ error: "QPay гэрээ хийгдээгүй байна" }, { status: 503 })
  }

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { tournament_id, player_id, amount, purpose } = await req.json()
  if (!tournament_id || !player_id || typeof amount !== "number" || amount < 0) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (player_id !== user.id) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const supabase = await createAdminClient()

  const expected = await resolveExpectedAmount(supabase, tournament_id, purpose)
  if (expected === null || amount !== expected) {
    return NextResponse.json({ error: "Дүн зөрсөн байна" }, { status: 400 })
  }

  // Create payment transaction
  const { data: txn, error: txnErr } = await supabase
    .from("payment_transactions")
    .insert({
      player_id,
      tournament_id,
      amount,
      currency: "MNT",
      provider: "qpay",
      status: "pending",
      metadata: purpose ? { purpose } : {},
    })
    .select("id")
    .single()

  if (txnErr || !txn) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  try {
    const token = await getQPayToken()

    // Create QPay invoice
    const invoiceRes = await fetch(`${QPAY_BASE}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: txn.id,
        invoice_receiver_code: player_id,
        invoice_description: purpose === "platform_fee" ? `DartMN платформ шимтгэл` : `DartMN тэмцээний хураамж`,
        amount,
        callback_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qpay-callback?txn_id=${txn.id}`,
      }),
    })

    const invoice = await invoiceRes.json()

    if (invoice.invoice_id) {
      await supabase
        .from("payment_transactions")
        .update({
          invoice_id: invoice.invoice_id,
          qr_text: invoice.qr_text,
          deep_link: invoice.urls?.[0]?.link ?? null,
        })
        .eq("id", txn.id)

      return NextResponse.json({
        transaction_id: txn.id,
        invoice_id: invoice.invoice_id,
        qr_text: invoice.qr_text,
        qr_image: invoice.qr_image,
        urls: invoice.urls,
      })
    } else {
      return NextResponse.json({ error: "QPay invoice failed", details: invoice }, { status: 502 })
    }
  } catch (err) {
    return NextResponse.json({ error: "QPay connection failed" }, { status: 502 })
  }
}
