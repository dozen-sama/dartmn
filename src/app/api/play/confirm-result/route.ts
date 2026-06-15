import { createClient, createAdminClient } from "@/lib/supabase/server"
import { applyMatchResult, type MatchPlayer } from "@/lib/local-game/match-stats"
import { NextRequest, NextResponse } from "next/server"

// Хүлээгдэж буй үр дүнг эсрэг багийн гишүүн баталгаажуулах / татгалзах (1v1 →
// ганц өрсөлдөгч). Баталгаажуулсан үед л ELO/статистик орно (нэг удаа — claim-first).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !["confirm", "reject"].includes(action)) {
    return NextResponse.json({ error: "Буруу утга" }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: pmr } = await admin.from("pending_match_results").select("*").eq("id", id).maybeSingle()
  if (!pmr) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 })
  // Эсрэг багийн аль нэг гишүүн баталгаажуулна (1v1 → ганц өрсөлдөгч).
  // confirmerIds байхгүй хуучин бичлэгт opponent_id руу буцаж нийцнэ.
  const confirmerIds = (pmr.payload as { confirmerIds?: string[] })?.confirmerIds ?? [pmr.opponent_id]
  if (!confirmerIds.includes(user.id)) return NextResponse.json({ error: "Зөвхөн өрсөлдөгч баталгаажуулна" }, { status: 403 })
  if (pmr.status !== "pending") return NextResponse.json({ error: "Аль хэдийн шийдэгдсэн" }, { status: 409 })

  // Claim — зөвхөн status='pending' үед нэг л дуудлага амжина (давхар apply-аас сэргийлнэ)
  const claimStatus = action === "confirm" ? "confirmed" : "rejected"
  const { data: claimed } = await admin.from("pending_match_results")
    .update({ status: claimStatus }).eq("id", id).eq("status", "pending").select("id")
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Аль хэдийн шийдэгдсэн" }, { status: 409 })
  }

  if (action === "confirm") {
    const pl = pmr.payload as { players?: MatchPlayer[]; mode?: string }
    const players = pl?.players ?? []
    const ok = await applyMatchResult(admin, players, pl?.mode ? `${pl.mode} тоглолт` : "Тоглолт")
    if (!ok) return NextResponse.json({ error: "Бүртгэхэд алдаа гарлаа" }, { status: 500 })
    await admin.from("notifications").insert({
      user_id: pmr.reporter_id, type: "match_confirmed",
      title: "Тоглолт баталгаажлаа",
      body: "Таны бүртгэсэн тоглолтыг өрсөлдөгч баталгаажууллаа — ELO/статистик шинэчлэгдлээ.",
      icon: "✅", link: "/stats",
    })
  } else {
    await admin.from("notifications").insert({
      user_id: pmr.reporter_id, type: "match_rejected",
      title: "Тоглолт татгалзагдлаа",
      body: "Өрсөлдөгч таны бүртгэсэн тоглолтыг баталгаажуулаагүй.",
      icon: "🚫", link: "/play",
    })
  }

  return NextResponse.json({ ok: true })
}
