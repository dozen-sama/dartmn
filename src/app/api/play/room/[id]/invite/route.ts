import { createClient, createAdminClient } from "@/lib/supabase/server"
import { slotInBounds, type RoomMode } from "@/lib/local-game/room"
import { NextRequest, NextResponse } from "next/server"

// Host тоглогчийг тодорхой team/slot-д урина → room_invites + notification.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { inviteeId, team, slot } = await req.json()
  if (!inviteeId) return NextResponse.json({ error: "Тоглогч заагаагүй" }, { status: 400 })

  const admin = await createAdminClient()
  const { data: room } = await admin.from("online_rooms").select("id, host_id, mode, status").eq("id", id).maybeSingle()
  if (!room) return NextResponse.json({ error: "Өрөө олдсонгүй" }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: "Зөвхөн host урина" }, { status: 403 })
  if (room.status !== "waiting") return NextResponse.json({ error: "Тоглолт эхэлсэн" }, { status: 409 })
  if (inviteeId === user.id) return NextResponse.json({ error: "Өөрийгөө урих боломжгүй" }, { status: 400 })
  if (!slotInBounds(room.mode as RoomMode, team, slot)) {
    return NextResponse.json({ error: "Буруу байрлал" }, { status: 400 })
  }

  // Энэ slot эзлэгдсэн эсэх (room_players эсвэл pending invite)
  const [{ data: players }, { data: invites }] = await Promise.all([
    admin.from("room_players").select("player_id, team, slot").eq("room_id", id),
    admin.from("room_invites").select("invitee_id, team, slot, status").eq("room_id", id).eq("status", "pending"),
  ])
  const taken = [...(players ?? []), ...(invites ?? [])].some((x) => x.team === team && x.slot === slot)
  if (taken) return NextResponse.json({ error: "Энэ байр эзлэгдсэн" }, { status: 409 })
  if ((players ?? []).some((p) => p.player_id === inviteeId)) {
    return NextResponse.json({ error: "Аль хэдийн орсон" }, { status: 409 })
  }

  // Урилга үүсгэх (нэг өрөөнд нэг хүнд нэг урилга — давхцвал шинэчилнэ)
  const { error } = await admin.from("room_invites").upsert({
    room_id: id, inviter_id: user.id, invitee_id: inviteeId, team, slot, status: "pending",
  }, { onConflict: "room_id,invitee_id" })
  if (error) return NextResponse.json({ error: "Урихад алдаа гарлаа" }, { status: 500 })

  const { data: host } = await admin.from("profiles").select("display_name, username").eq("id", user.id).single()
  const hName = host?.display_name || host?.username || "Тоглогч"
  await admin.from("notifications").insert({
    user_id: inviteeId,
    type: "room_invite",
    title: "Онлайн тоглолтын урилга",
    body: `${hName} таныг онлайн тоглолтод урилаа.`,
    icon: "🎮",
    link: `/play/${id}`,
    data: { room_id: id },
  })

  return NextResponse.json({ ok: true })
}
