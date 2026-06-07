import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getEffect, computeXp } from "@/lib/frames"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { item_key } = await req.json()
  const eff = getEffect(item_key)
  if (!eff || eff.key === "none") return NextResponse.json({ error: "Буруу effect" }, { status: 400 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, matches_played, matches_won, count_180, tournament_wins, avraga_wins")
    .eq("id", user.id)
    .single()
  if (!profile) return NextResponse.json({ error: "Профайл олдсонгүй" }, { status: 404 })

  // Subscription заавал (нээх үед)
  if (!profile.is_premium) {
    return NextResponse.json({ error: "Subscription шаардлагатай" }, { status: 403 })
  }

  const xp = computeXp(profile)
  if (xp < eff.xp) {
    return NextResponse.json({ error: `XP хүрэлцэхгүй (${xp}/${eff.xp})` }, { status: 400 })
  }

  // Насан туршийн нээлт — player_unlocks-д бүртгэх
  const admin = await createAdminClient()
  const { error } = await admin
    .from("player_unlocks")
    .upsert({ player_id: user.id, item_kind: "effect", item_key: eff.key }, { onConflict: "player_id,item_kind,item_key" })
  if (error) return NextResponse.json({ error: "Нээхэд алдаа гарлаа" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
