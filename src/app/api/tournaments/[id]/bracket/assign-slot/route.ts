import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// KO bracket-ийн нэг нүдэнд entrant хуваарилах.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })

  const { matchId, side, entrantId } = await req.json() as {
    matchId: string; side: 1 | 2; entrantId: string | null
  }
  if (!matchId || (side !== 1 && side !== 2)) {
    return NextResponse.json({ error: "matchId болон side (1 эсвэл 2) шаардлагатай" }, { status: 400 })
  }

  const update = side === 1 ? { side1_entrant_id: entrantId } : { side2_entrant_id: entrantId }
  const { error } = await admin.from("tournament_matches")
    .update(update)
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)

  if (error) return NextResponse.json({ error: "Шинэчлэхэд алдаа", detail: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
