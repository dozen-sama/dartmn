import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  await admin.from("matchmaking_queue").delete().eq("player_id", user.id)

  return NextResponse.json({ ok: true })
}
