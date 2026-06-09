import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Элсэх хүсэлтийг ЗӨВШӨӨРӨХ / ТАТГАЛЗАХ (зөвхөн Удирдагч, Орлогч)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { club_id, player_id, action } = await req.json()
  if (!club_id || !player_id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Буруу утга" }, { status: 400 })
  }

  // Дуудагч Удирдагч/Орлогч мөн эсэх
  const { data: me } = await supabase
    .from("club_members").select("role").eq("club_id", club_id).eq("player_id", user.id).maybeSingle()
  if (!me || !["owner", "admin"].includes(me.role)) {
    return NextResponse.json({ error: "Зөвхөн Удирдагч, Орлогч зөвшөөрнө" }, { status: 403 })
  }

  const admin = await createAdminClient()

  // Хүсэлт байгаа эсэх
  const { data: request } = await admin
    .from("club_join_requests").select("id").eq("club_id", club_id).eq("player_id", player_id).maybeSingle()
  if (!request) return NextResponse.json({ error: "Хүсэлт олдсонгүй" }, { status: 404 })

  const { data: club } = await admin.from("clubs").select("name").eq("id", club_id).single()

  if (action === "approve") {
    // Гишүүн болгох (давхардсан бол алдаа алгасна)
    const { error } = await admin.from("club_members").insert({ club_id, player_id, role: "member" })
    // 23505 = unique_violation (аль хэдийн гишүүн) — алгасна
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "Зөвшөөрөхөд алдаа гарлаа" }, { status: 500 })
    }
    await admin.from("notifications").insert({
      user_id: player_id, type: "club_approved",
      title: "Элсэх хүсэлт зөвшөөрөгдлөө",
      body: `Та "${club?.name}" клубын гишүүн боллоо 🎉`,
      icon: "✅", link: `/clubs/${club_id}`,
    })
  } else {
    await admin.from("notifications").insert({
      user_id: player_id, type: "club_rejected",
      title: "Элсэх хүсэлт татгалзагдлаа",
      body: `"${club?.name}" клуб таны хүсэлтийг хүлээж аваагүй`,
      icon: "🚫", link: `/clubs/${club_id}`,
    })
  }

  // Хүсэлтийг устгах
  await admin.from("club_join_requests").delete().eq("id", request.id)

  return NextResponse.json({ ok: true })
}
