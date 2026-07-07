import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Bull-off — баг бүрийн slot0 (төлөөлөгч) бухны цохилтоо оруулна (0..50, өндөр=ойр).
// Хоёр баг оруулсны дараа өндөр нь эхэлнэ; тэнцвэл дахин (хоёуланг цэвэрлэнэ).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const score = Number((await req.json()).score)
  if (!Number.isInteger(score) || score < 0 || score > 50) {
    return NextResponse.json({ error: "Буруу утга" }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, status").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "bulloff") return NextResponse.json({ error: "Bull-off фаз биш" }, { status: 409 })

  const { data: players } = await admin.from("room_players").select("player_id, team, slot, bulloff").eq("room_id", id)
  const me = (players ?? []).find((p) => p.player_id === user.id)
  if (!me) return NextResponse.json({ error: "Та энэ өрөөнд байхгүй" }, { status: 403 })
  if (me.slot !== 0) return NextResponse.json({ error: "Зөвхөн багийн төлөөлөгч (1-р тоглогч) шиднэ" }, { status: 403 })

  await admin.from("room_players").update({ bulloff: score }).eq("room_id", id).eq("player_id", user.id)

  // Хоёр багийн төлөөлөгч хоёулаа оруулсан эсэх — өөрийн бичилтийн ДАРАА fresh унших
  // (өрсөлдөгч ижил хугацаанд илгээвэл stale снапшот дээр үндэслэвэл шилжилт бүрмөсөн алдагдаж болно)
  const { data: freshReps } = await admin.from("room_players").select("player_id, team, slot, bulloff")
    .eq("room_id", id).eq("slot", 0)
  const reps = freshReps ?? []
  const t0 = reps.find((p) => p.team === 0)
  const t1 = reps.find((p) => p.team === 1)
  if (t0?.bulloff != null && t1?.bulloff != null) {
    if (t0.bulloff === t1.bulloff) {
      // Тэнцэв — дахин шидэх (хоёуланг цэвэрлэнэ)
      await admin.from("room_players").update({ bulloff: null }).eq("room_id", id).in("slot", [0])
      return NextResponse.json({ ok: true, tie: true })
    }
    const starter = t0.bulloff > t1.bulloff ? 0 : 1
    await admin.from("online_rooms")
      .update({ status: "ongoing", starter_team: starter })
      .eq("id", id).eq("status", "bulloff")
  }

  return NextResponse.json({ ok: true })
}
