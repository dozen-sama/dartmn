import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getFrame, isFrameUnlocked } from "@/lib/frames"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { frame, effect, color, font, animated } = await req.json()

  const { data: profile } = await supabase
    .from("profiles")
    .select("rating_points, is_premium")
    .eq("id", user.id)
    .single()
  if (!profile) return NextResponse.json({ error: "Профайл олдсонгүй" }, { status: 404 })

  // Хүрээ — нээгдсэн эсэхийг шалгах (rating/subscription)
  const frameKey = frame && frame !== "none" ? String(frame) : null
  if (frameKey) {
    const f = getFrame(frameKey)
    if (!f) return NextResponse.json({ error: "Буруу хүрээ" }, { status: 400 })
    // Насан туршийн нээлт (player_unlocks) эсвэл одоо эрхтэй эсэх
    const { data: ownedFrame } = await supabase
      .from("player_unlocks").select("id")
      .eq("player_id", user.id).eq("item_kind", "frame").eq("item_key", frameKey).maybeSingle()
    const eligible = isFrameUnlocked(f, { rating: profile.rating_points, isPremium: profile.is_premium })
    if (!ownedFrame && !eligible) {
      return NextResponse.json({ error: "Хүрээ нээгдээгүй байна" }, { status: 403 })
    }
  }

  // Effect — эзэмшиж байгаа эсэхийг шалгах
  const effectKey = effect && effect !== "none" ? String(effect) : null
  if (effectKey) {
    const { data: effExists } = await supabase
      .from("cosmetic_effects").select("key").eq("key", effectKey).maybeSingle()
    if (!effExists) return NextResponse.json({ error: "Буруу effect" }, { status: 400 })
    const { data: owned } = await supabase
      .from("player_unlocks")
      .select("id")
      .eq("player_id", user.id)
      .eq("item_kind", "effect")
      .eq("item_key", effectKey)
      .maybeSingle()
    if (!owned) return NextResponse.json({ error: "Энэ effect-ийг нээгээгүй байна" }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { error } = await admin.from("profiles").update({
    equipped_frame: frameKey,
    name_effect: effectKey,
    name_color: typeof color === "string" && color ? color : null,
    name_font: typeof font === "string" && font ? font : null,
    name_animated: animated !== false,
  }).eq("id", user.id)
  if (error) return NextResponse.json({ error: "Хадгалахад алдаа гарлаа" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
