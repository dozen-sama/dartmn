import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("byl-signature") ?? ""
  const secret = process.env.BYL_WEBHOOK_SECRET ?? ""

  if (!secret) {
    return NextResponse.json({ error: "Webhook тохиргоо дутуу байна" }, { status: 503 })
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  const signatureBuf = Buffer.from(signature, "hex")
  if (
    expectedBuf.length !== signatureBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, signatureBuf)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: { type?: string; data?: { object?: { description?: string } } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (event.type !== "invoice.paid") {
    return NextResponse.json({ ok: true })
  }

  // invoice description-д txn.id байгаа тул татна: "... [uuid]"
  const description: string = event.data?.object?.description ?? ""
  const match = description.match(/\[([0-9a-f-]{36})\]$/)
  const txnId = match?.[1]
  if (!txnId) return NextResponse.json({ ok: true })

  const supabase = await createAdminClient()

  // provider="byl" + status="pending" нөхцөлтэй нэг атомик UPDATE:
  // - өөр provider-ийн (жишээ нь qpay) ижил id-тай мөрийг санамсаргүй өөрчлөхгүй
  // - давхардсан "invoice.paid" webhook хэд ч удаа ирсэн, зөвхөн НЭГ л удаа
  //   доорх талбар шинэчлэлт (platform_fee_paid/registration) ажиллана —
  //   давхар credit/бүртгэл үүсэхгүй
  const { data: txn } = await supabase
    .from("payment_transactions")
    .update({ status: "paid" })
    .eq("id", txnId)
    .eq("provider", "byl")
    .eq("status", "pending")
    .select("player_id, tournament_id, metadata")
    .maybeSingle()

  if (!txn?.tournament_id) return NextResponse.json({ ok: true })

  const purpose = (txn.metadata as Record<string, string> | null)?.purpose

  if (purpose === "platform_fee") {
    await supabase
      .from("tournaments")
      .update({ platform_fee_paid: true })
      .eq("id", txn.tournament_id)
  } else if (txn.player_id) {
    await supabase
      .from("tournament_registrations")
      .update({ payment_status: "paid", payment_id: txnId })
      .eq("tournament_id", txn.tournament_id)
      .eq("player_id", txn.player_id)
  }

  return NextResponse.json({ ok: true })
}
