import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Клубт элсэх ХҮСЭЛТ илгээх → Удирдагч, Орлогч нарт мэдэгдэл очно (шууд элсэхгүй)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { club_id } = await req.json()
  if (!club_id) return NextResponse.json({ error: "Буруу утга" }, { status: 400 })

  // Аль хэдийн гишүүн үү
  const { data: member } = await supabase
    .from("club_members").select("id").eq("club_id", club_id).eq("player_id", user.id).maybeSingle()
  if (member) return NextResponse.json({ error: "Та аль хэдийн гишүүн байна" }, { status: 400 })

  const admin = await createAdminClient()

  // Хүсэлт үүсгэх (давхар хүсэлт — алдаа өгөхгүй)
  const { error: reqErr } = await admin
    .from("club_join_requests").upsert({ club_id, player_id: user.id }, { onConflict: "club_id,player_id" })
  if (reqErr) return NextResponse.json({ error: "Хүсэлт илгээхэд алдаа гарлаа" }, { status: 500 })

  // Клуб + хүсэлт явуулсан хүний нэр
  const [{ data: club }, { data: requester }] = await Promise.all([
    admin.from("clubs").select("id, name").eq("id", club_id).single(),
    admin.from("profiles").select("display_name, username").eq("id", user.id).single(),
  ])

  // Удирдагч + Орлогч нарт мэдэгдэх
  const { data: staff } = await admin
    .from("club_members").select("player_id").eq("club_id", club_id).in("role", ["owner", "admin"])

  const reqName = requester?.display_name || requester?.username || "Тоглогч"
  if (staff && staff.length) {
    await admin.from("notifications").insert(
      staff.map((s) => ({
        user_id: s.player_id,
        type: "club_join_request",
        title: "Шинэ элсэх хүсэлт",
        body: `${reqName} "${club?.name}" клубт элсэхийг хүсэж байна`,
        icon: "👋",
        link: `/clubs/${club_id}?tab=requests`,
        data: { club_id, requester_id: user.id, requester_username: requester?.username },
      }))
    )
  }

  return NextResponse.json({ ok: true })
}
