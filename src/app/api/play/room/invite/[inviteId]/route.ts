import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Уригдсан тоглогч урилгыг хүлээн авах / татгалзах.
// Хүлээн авбал claim-first room_players insert (нэг л slot, давхар дүүргэхээс сэргийлнэ).
export async function POST(req: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { action } = await req.json()
  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: inv } = await admin.from("room_invites").select("*").eq("id", inviteId).maybeSingle()
  if (!inv) return NextResponse.json({ error: "Урилга олдсонгүй" }, { status: 404 })
  if (inv.invitee_id !== user.id) return NextResponse.json({ error: "Эрхгүй" }, { status: 403 })
  if (inv.status !== "pending") return NextResponse.json({ error: "Аль хэдийн шийдэгдсэн" }, { status: 409 })

  // Claim — зөвхөн pending үед нэг л дуудлага амжина
  const newStatus = action === "accept" ? "accepted" : "declined"
  const { data: claimed } = await admin.from("room_invites")
    .update({ status: newStatus }).eq("id", inviteId).eq("status", "pending").select("id")
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Аль хэдийн шийдэгдсэн" }, { status: 409 })
  }

  if (action === "accept") {
    const { data: room } = await admin.from("online_rooms").select("id, host_id, status").eq("id", inv.room_id).maybeSingle()
    if (!room || room.status !== "waiting") {
      return NextResponse.json({ error: "Өрөө бэлэн биш" }, { status: 409 })
    }
    // slot руу оруулах — unique(room_id,team,slot) болон unique(room_id,player_id) хамгаална
    const { error } = await admin.from("room_players").insert({
      room_id: inv.room_id, player_id: user.id, team: inv.team, slot: inv.slot, is_ready: false,
    })
    if (error) {
      // slot аль хэдийн дүүрсэн / аль хэдийн орсон
      return NextResponse.json({ error: "Энэ байр дүүрсэн байна" }, { status: 409 })
    }
    const { data: me } = await admin.from("profiles").select("display_name, username").eq("id", user.id).single()
    const mName = me?.display_name || me?.username || "Тоглогч"
    await admin.from("notifications").insert({
      user_id: inv.inviter_id, type: "room_invite_accepted",
      title: "Урилга хүлээн авлаа",
      body: `${mName} таны онлайн тоглолтын урилгыг хүлээн авлаа.`,
      icon: "✅", link: `/play/${inv.room_id}`,
    })
  }

  return NextResponse.json({ ok: true })
}
