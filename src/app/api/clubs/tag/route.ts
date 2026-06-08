import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Клубын tag өнгө сонгох (Удирдагч/Орлогч). Бүх гишүүний профайлд denormalize.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { club_id, tag_color } = await req.json()
  if (!club_id) return NextResponse.json({ error: "club_id дутуу" }, { status: 400 })

  const { data: me } = await supabase
    .from("club_members").select("role").eq("club_id", club_id).eq("player_id", user.id).maybeSingle()
  if (me?.role !== "owner" && me?.role !== "admin") {
    return NextResponse.json({ error: "Зөвхөн Удирдагч/Орлогч" }, { status: 403 })
  }

  const color = typeof tag_color === "string" && tag_color ? tag_color : null

  const admin = await createAdminClient()
  const { error } = await admin.from("clubs").update({ tag_color: color }).eq("id", club_id)
  if (error) return NextResponse.json({ error: "Хадгалахад алдаа" }, { status: 500 })

  // Энэ клубыг үндсэн клубаа болгосон бүх гишүүнд tag өнгө тараах
  await admin.from("profiles").update({ primary_club_tag_color: color }).eq("primary_club_id", club_id)

  return NextResponse.json({ ok: true })
}
