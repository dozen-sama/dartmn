import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Swiss: тэмцээнийг дуусгах (зөвхөн зохион байгуулагч). Swiss-д авто-дуусгалт
// байхгүй (тойргийн тоог зохион байгуулагч шийднэ) тул гараар дуусгана. Бүх match
// дууссан байх ёстой. Аварга = эцсийн хүснэгтийн тэргүүн (UI-д тооцно).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, status, bracket_type")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (t.bracket_type !== "swiss") return NextResponse.json({ error: "Зөвхөн Swiss тэмцээнд" }, { status: 400 })
  if (t.status !== "ongoing") return NextResponse.json({ error: "Тэмцээн идэвхгүй байна" }, { status: 409 })

  const { count: pending } = await admin.from("tournament_matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId).neq("status", "completed")
  if (pending && pending > 0) return NextResponse.json({ error: `${pending} тоглолт дуусаагүй байна` }, { status: 409 })

  const { error } = await admin.from("tournaments").update({ status: "completed" }).eq("id", tournamentId)
  if (error) return NextResponse.json({ error: "Дуусгахад алдаа", detail: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
