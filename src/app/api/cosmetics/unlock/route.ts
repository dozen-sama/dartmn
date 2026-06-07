import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { computeXp, spentXp, isPassActive } from "@/lib/cosmetics"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { item_key } = await req.json()
  if (!item_key) return NextResponse.json({ error: "Буруу effect" }, { status: 400 })

  // Effect-ийг DB-ээс
  const { data: eff } = await supabase
    .from("cosmetic_effects")
    .select("key, xp, pass_id, is_active")
    .eq("key", item_key)
    .maybeSingle()
  if (!eff || !eff.is_active) return NextResponse.json({ error: "Effect олдсонгүй" }, { status: 400 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, matches_played, matches_won, count_180, tournament_wins, avraga_wins")
    .eq("id", user.id)
    .single()
  if (!profile) return NextResponse.json({ error: "Профайл олдсонгүй" }, { status: 404 })
  if (!profile.is_premium) return NextResponse.json({ error: "Subscription шаардлагатай" }, { status: 403 })

  // Pass идэвхтэй (сезон нээлттэй) эсэх
  if (eff.pass_id) {
    const { data: pass } = await supabase
      .from("cosmetic_passes").select("id, name, starts_at, ends_at").eq("id", eff.pass_id).maybeSingle()
    if (!isPassActive(pass)) return NextResponse.json({ error: "Pass хаагдсан байна" }, { status: 403 })
  }

  // Аль хэдийн нээсэн эсэх + боломжит XP
  const { data: existing } = await supabase
    .from("player_unlocks").select("item_key").eq("player_id", user.id).eq("item_kind", "effect")
  const ownedKeys = (existing ?? []).map((r) => r.item_key)
  if (ownedKeys.includes(eff.key)) return NextResponse.json({ ok: true })

  const { data: allEffects } = await supabase.from("cosmetic_effects").select("key, xp")
  const available = computeXp(profile) - spentXp(ownedKeys, allEffects ?? [])
  if (available < eff.xp) {
    return NextResponse.json({ error: `Боломжит XP хүрэлцэхгүй (${available}/${eff.xp})` }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from("player_unlocks")
    .upsert({ player_id: user.id, item_kind: "effect", item_key: eff.key }, { onConflict: "player_id,item_kind,item_key" })
  if (error) return NextResponse.json({ error: "Нээхэд алдаа гарлаа" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
