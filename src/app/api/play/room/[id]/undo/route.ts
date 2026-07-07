import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Сүүлийн шидэлтийг буцаах (засах) — ЗӨВХӨН өөрийн оруулсан, ХАМГИЙН СҮҮЛИЙН visit-ийг,
// өрсөлдөгч дараагийн ээлжээ шидэхээс өмнө. Дараа нь дахин зөв оноогоо оруулна.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, status").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.status !== "ongoing") return NextResponse.json({ error: "Тоглолт идэвхгүй" }, { status: 409 })

  const { data: last } = await admin.from("room_visits")
    .select("id, seq, created_by").eq("room_id", id).order("seq", { ascending: false }).limit(1).maybeSingle()
  if (!last) return NextResponse.json({ error: "Буцаах шидэлт алга" }, { status: 409 })
  if (last.created_by !== user.id) {
    return NextResponse.json({ error: "Зөвхөн өөрийн сүүлийн шидэлтийг буцаана" }, { status: 403 })
  }

  // Атомик RPC: устгах statement дотроо "энэ visit-ээс seq өндөр мөр байхгүй" гэдгийг
  // шалгадаг тул (өрсөлдөгч дунд нь шинэ ээлж нэмсэн эсэхийг) race-гүйгээр баталгаажуулна.
  const { data: deleted, error } = await admin.rpc("undo_last_room_visit", {
    p_room_id: id, p_user_id: user.id,
  })
  if (error) return NextResponse.json({ error: "Алдаа гарлаа" }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Аль хэдийн өөрчлөгдсөн" }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
