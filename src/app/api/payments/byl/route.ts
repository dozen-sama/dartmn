import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { resolveExpectedAmount } from "@/lib/payments/validate-amount"

const BYL_BASE = "https://byl.mn/api/v1"
const BYL_TOKEN = process.env.BYL_TOKEN ?? ""
const BYL_PROJECT_ID = process.env.BYL_PROJECT_ID ?? ""

export async function POST(req: NextRequest) {
  if (!BYL_TOKEN || !BYL_PROJECT_ID) {
    return NextResponse.json({ error: "byl.mn гэрээ хийгдээгүй байна" }, { status: 503 })
  }

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { tournament_id, player_id, amount, purpose } = await req.json()
  // Subscription худалдан авалт (жишээ нь "subscription_premium") нь ямар ч
  // тэмцээнтэй холбоогүй тул tournament_id шаардахгүй. payment_transactions.
  // tournament_id багана null зөвшөөрдөг (FK ON DELETE SET NULL) — өмнө нь
  // checkout хуудас байхгүй тэмцээний sentinel UUID дамжуулж FK constraint
  // зөрчиж байсныг доор null болгож засав.
  const isSubscription = typeof purpose === "string" && purpose.startsWith("subscription_")
  if (!player_id || typeof amount !== "number" || amount < 0 || (!isSubscription && !tournament_id)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (player_id !== user.id) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const supabase = await createAdminClient()

  const expected = await resolveExpectedAmount(supabase, tournament_id, purpose)
  if (expected === null || amount !== expected) {
    return NextResponse.json({ error: "Дүн зөрсөн байна" }, { status: 400 })
  }

  const { data: txn, error: txnErr } = await supabase
    .from("payment_transactions")
    .insert({
      player_id,
      tournament_id: isSubscription ? null : tournament_id,
      amount,
      currency: "MNT",
      provider: "byl",
      status: "pending",
      metadata: purpose ? { purpose } : {},
    })
    .select("id")
    .single()

  if (txnErr || !txn) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  try {
    const description = purpose === "platform_fee"
      ? `DartMN платформ шимтгэл`
      : `DartMN тэмцааний хураамж`

    const res = await fetch(`${BYL_BASE}/projects/${BYL_PROJECT_ID}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BYL_TOKEN}`,
      },
      body: JSON.stringify({
        amount,
        description: `${description} [${txn.id}]`,
      }),
    })

    const rawBody = await res.text()
    let invoice: { id?: string; url?: string } = {}
    try {
      invoice = JSON.parse(rawBody)
    } catch {
      // BYL error responses are not always JSON (e.g. an HTML/plain-text
      // gateway error) — fall through with an empty object, rawBody is
      // still logged below for diagnosis.
    }

    if (invoice.id && invoice.url) {
      await supabase
        .from("payment_transactions")
        .update({ invoice_id: invoice.id })
        .eq("id", txn.id)

      return NextResponse.json({
        transaction_id: txn.id,
        invoice_id: invoice.id,
        payment_url: invoice.url,
      })
    }

    // res.status/rawBody-г серверийн лог руу бичиж байна — client рүү буцаах
    // алдааны мэдээлэл товч ("byl.mn invoice амжилтгүй") учир Vercel logs
    // шалгахгүйгээр бодит шалтгааныг (401 буруу token, 404 буруу project id
    // гэх мэт) олж харах боломжгүй байсныг засав.
    console.error("[byl] invoice creation failed", { status: res.status, body: rawBody.slice(0, 2000) })
    return NextResponse.json({ error: "byl.mn invoice амжилтгүй", details: invoice }, { status: 502 })
  } catch (err) {
    console.error("[byl] API request threw", err)
    return NextResponse.json({ error: "byl.mn API холболтын алдаа" }, { status: 502 })
  }
}
