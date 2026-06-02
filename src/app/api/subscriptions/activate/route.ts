import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { player_id, transaction_id } = await req.json()
  if (!player_id) return NextResponse.json({ error: "Missing player_id" }, { status: 400 })

  const supabase = await createAdminClient()
  const expires = new Date()
  expires.setMonth(expires.getMonth() + 1)

  await supabase.from("player_subscriptions").upsert({
    player_id,
    status: "active",
    expires_at: expires.toISOString(),
    amount: 9900,
    payment_id: transaction_id ?? null,
  }, { onConflict: "player_id" })

  await supabase.from("profiles").update({
    is_premium: true,
    premium_expires_at: expires.toISOString(),
  }).eq("id", player_id)

  return NextResponse.json({ ok: true })
}
