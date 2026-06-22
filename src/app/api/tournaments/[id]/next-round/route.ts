import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildSwissNextRoundRows, type EntrantSeed, type ExistingSwissMatch } from "@/lib/tournament/bracket-server"
import { NextRequest, NextResponse } from "next/server"

// Swiss: дараагийн тойрог үүсгэх (зөвхөн зохион байгуулагч). Одоогийн тойргийн бүх
// match дууссан байх ёстой. Хүснэгтээс хослуулж, давтан тулаанаас зайлсхийнэ.
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

  const { data: matches } = await admin.from("tournament_matches")
    .select("round, side1_entrant_id, side2_entrant_id, side1_legs, side2_legs, winner_entrant_id, status")
    .eq("tournament_id", tournamentId)
  if (!matches || matches.length === 0) return NextResponse.json({ error: "Bracket олдсонгүй" }, { status: 404 })

  const existing = matches as ExistingSwissMatch[]
  const pending = existing.filter((m) => m.status !== "completed")
  if (pending.length > 0) {
    return NextResponse.json({ error: `${pending.length} тоглолт дуусаагүй байна` }, { status: 409 })
  }
  const currentRound = Math.max(...existing.map((m) => m.round))

  const { data: entrants } = await admin.from("tournament_entrants")
    .select("id, seed").eq("tournament_id", tournamentId)
  const seeds = ((entrants ?? []) as { id: string; seed: number }[]).map((e) => ({ id: e.id, seed: e.seed }) as EntrantSeed)

  const newRows = buildSwissNextRoundRows(tournamentId, seeds, existing, currentRound)
  if (newRows.length === 0) {
    return NextResponse.json({ error: "Боломжит шинэ хослол алга (бүгд тоглосон). Тэмцээнийг дуусгана уу." }, { status: 409 })
  }

  const { error } = await admin.from("tournament_matches").insert(newRows)
  if (error) return NextResponse.json({ error: "Тойрог нэмэхэд алдаа", detail: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, round: currentRound + 1, matches: newRows.length })
}
