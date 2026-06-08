import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const MAX_DEPUTIES = 3

// Клубын гишүүний цол өөрчлөх (зөвхөн Удирдагч). admin=Орлогч, member=энгийн.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { club_id, player_id, role } = await req.json()
  if (!club_id || !player_id || !["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Буруу утга" }, { status: 400 })
  }
  if (player_id === user.id) {
    return NextResponse.json({ error: "Өөрийн эрхээ өөрчлөх боломжгүй" }, { status: 400 })
  }

  // Дуудаж буй хүн Удирдагч (owner) мөн эсэх
  const { data: me } = await supabase
    .from("club_members").select("role").eq("club_id", club_id).eq("player_id", user.id).maybeSingle()
  if (me?.role !== "owner") {
    return NextResponse.json({ error: "Зөвхөн Удирдагч цол өөрчилнө" }, { status: 403 })
  }

  // Зорилтот гишүүн
  const { data: target } = await supabase
    .from("club_members").select("role").eq("club_id", club_id).eq("player_id", player_id).maybeSingle()
  if (!target) return NextResponse.json({ error: "Гишүүн олдсонгүй" }, { status: 404 })
  if (target.role === "owner") return NextResponse.json({ error: "Удирдагчийн цол өөрчлөх боломжгүй" }, { status: 400 })

  // Орлогч болгож байвал дээд тал 3
  if (role === "admin" && target.role !== "admin") {
    const { count } = await supabase
      .from("club_members").select("id", { count: "exact", head: true })
      .eq("club_id", club_id).eq("role", "admin")
    if ((count ?? 0) >= MAX_DEPUTIES) {
      return NextResponse.json({ error: `Орлогч дээд тал нь ${MAX_DEPUTIES}` }, { status: 400 })
    }
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from("club_members").update({ role }).eq("club_id", club_id).eq("player_id", player_id)
  if (error) return NextResponse.json({ error: "Хадгалахад алдаа" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
