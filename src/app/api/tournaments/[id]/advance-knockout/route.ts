import { createClient, createAdminClient } from "@/lib/supabase/server"
import { computeStandings, seedKnockout, type StandingMatch } from "@/lib/tournament/standings"
import { NextRequest, NextResponse } from "next/server"

// Groups + Knockout: бүлгийн шат дуусахад зохион байгуулагч энэ route-г дуудаж
// хүснэгтийн дээгүүр N-ийг шигшээ (KO) round-1-д суулгана. Seeding (cross-pairing)-г
// TS-д хийгээд seed_knockout RPC-аар атомикоор бичнэ; bye-уудыг авто-дэвшүүлнэ.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, status, bracket_type, group_advance")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (t.bracket_type !== "groups_knockout") return NextResponse.json({ error: "Зөвхөн бүлэг+шигшээ тэмцээнд" }, { status: 400 })
  if (t.status !== "ongoing") return NextResponse.json({ error: "Тэмцээн идэвхгүй байна" }, { status: 409 })

  const { data: matches } = await admin.from("tournament_matches")
    .select("id, round, match_number, group_no, side1_entrant_id, side2_entrant_id, side1_legs, side2_legs, winner_entrant_id, status, next_match_id")
    .eq("tournament_id", tournamentId)
  if (!matches || matches.length === 0) return NextResponse.json({ error: "Bracket олдсонгүй" }, { status: 404 })

  type M = {
    id: string; round: number; match_number: number; group_no: number | null
    side1_entrant_id: string | null; side2_entrant_id: string | null
    side1_legs: number; side2_legs: number; winner_entrant_id: string | null
    status: "pending" | "ongoing" | "completed"; next_match_id: string | null
  }
  const ms = matches as M[]

  // Бүлгийн бүх match дууссан эсэх
  const groupMatches = ms.filter((m) => m.group_no != null)
  const pendingGroup = groupMatches.filter((m) => m.status !== "completed")
  if (pendingGroup.length > 0) {
    return NextResponse.json({ error: `Бүлгийн ${pendingGroup.length} тоглолт дуусаагүй байна` }, { status: 409 })
  }

  // KO round-1 = group_no null match-уудын хамгийн бага round
  const koMatches = ms.filter((m) => m.group_no == null)
  if (koMatches.length === 0) return NextResponse.json({ error: "Шигшээ шат алга" }, { status: 400 })
  const koMinRound = Math.min(...koMatches.map((m) => m.round))
  const koR1 = koMatches.filter((m) => m.round === koMinRound).sort((a, b) => a.match_number - b.match_number)

  // Аль хэдийн seed-лэгдсэн бол (idempotent) ok буцаана
  if (koR1.some((m) => m.side1_entrant_id || m.side2_entrant_id)) {
    return NextResponse.json({ ok: true, alreadySeeded: true })
  }

  // entrant-ууд group_no-той
  const { data: entrants } = await admin.from("tournament_entrants")
    .select("id, group_no").eq("tournament_id", tournamentId)
  const ents = (entrants ?? []) as { id: string; group_no: number | null }[]
  const groupNos = [...new Set(ents.map((e) => e.group_no).filter((g): g is number => g != null))].sort((a, b) => a - b)

  // бүлэг тус бүрийн хүснэгт → дээгүүр N
  const advanceCount = Math.max(1, t.group_advance ?? 1)
  const rankedByGroup: string[][] = groupNos.map((gno) => {
    const groupEntrantIds = ents.filter((e) => e.group_no === gno).map((e) => e.id)
    const groupMs = groupMatches.filter((m) => m.group_no === gno) as unknown as StandingMatch[]
    const standing = computeStandings(groupEntrantIds, groupMs)
    return standing.slice(0, advanceCount).map((s) => s.entrantId)
  })

  const pairs = seedKnockout(rankedByGroup, advanceCount, koR1.length)
  const assignments = koR1.map((m, i) => ({ match_id: m.id, side1: pairs[i]?.[0] ?? null, side2: pairs[i]?.[1] ?? null }))

  const { error: seedErr } = await admin.rpc("seed_knockout", {
    p_tournament_id: tournamentId,
    p_assignments: assignments,
  })
  if (seedErr) return NextResponse.json({ error: "Seed хийхэд алдаа", detail: seedErr.message }, { status: 500 })

  // Bye-уудыг авто-дэвшүүлэх: яг нэг талтай KO R1 match → ялагч дараагийн шатанд
  for (const a of assignments) {
    const hasS1 = !!a.side1, hasS2 = !!a.side2
    if (hasS1 !== hasS2) {
      const winningSide = hasS1 ? 1 : 2
      await admin.rpc("advance_tournament_match", {
        p_match_id: a.match_id, p_winning_side: winningSide, p_side1_legs: 0, p_side2_legs: 0,
      })
    }
  }

  return NextResponse.json({ ok: true, seeded: assignments.length })
}
