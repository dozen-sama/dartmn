import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Client pings this every few seconds while status='searching' to prove the
// tab is still open. Without it, a closed/crashed tab leaves a "ghost" row
// behind that matchmaking_claim_match would otherwise offer to real players
// as an opponent forever.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  await admin.rpc("matchmaking_heartbeat", { p_player_id: user.id })

  return NextResponse.json({ ok: true })
}
