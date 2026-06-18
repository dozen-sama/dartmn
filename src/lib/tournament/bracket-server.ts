import { randomUUID } from "node:crypto"
import { generateSingleElimination } from "@/lib/local-game/bracket"
import type { LocalPlayer } from "@/lib/local-game/types"

// Online тэмцээний bracket-ийг DB-д хадгалах давхарга. `bracket.ts`-ийн pure
// генераторуудыг (local тэмцээнтэй ижил) дуудаж, генераторын текст id-г uuid руу
// map хийгээд `tournament_matches`-д insert хийхэд бэлэн мөрүүд гаргана.
// Phase 1: single elimination. Phase 2-д DE/RR/Groups/Swiss нэмэгдэнэ.

export interface EntrantSeed {
  id: string // tournament_entrants.id (uuid)
  seed: number
}

export interface TournamentMatchRow {
  id: string
  tournament_id: string
  round: number
  match_number: number
  is_losers_bracket: boolean
  group_no: number | null
  side1_entrant_id: string | null
  side2_entrant_id: string | null
  side1_legs: number
  side2_legs: number
  winner_entrant_id: string | null
  loser_entrant_id: string | null
  status: "pending" | "ongoing" | "completed"
  next_match_id: string | null
  next_loser_match_id: string | null
}

// Генераторын player slot ("bye" эсвэл хоосон placeholder) → entrant id | null
function normSide(v: string | "bye" | null | undefined): string | null {
  return !v || v === "bye" ? null : v
}

// Single elimination bracket-ийг tournament_matches мөр болгож гаргана.
// Bye match-уудыг (round 1-д "bye"-тэй) автоматаар дуусгаж, ялагчийг дараагийн
// match-руу шилжүүлнэ — local store-ийн зан төлөвтэй нийцнэ.
export function buildSingleEliminationRows(
  tournamentId: string,
  entrants: EntrantSeed[],
): TournamentMatchRow[] {
  // Генератор зөвхөн .id, .seed-ийг ашигладаг (name утгагүй).
  const players: LocalPlayer[] = entrants.map((e) => ({ id: e.id, name: e.id, seed: e.seed }))
  const matches = generateSingleElimination(players)

  // Генераторын текст id → DB uuid
  const idMap = new Map<string, string>()
  for (const m of matches) idMap.set(m.id, randomUUID())

  const rows: TournamentMatchRow[] = matches.map((m) => ({
    id: idMap.get(m.id)!,
    tournament_id: tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    is_losers_bracket: m.isLosersBracket ?? false,
    group_no: null,
    side1_entrant_id: normSide(m.player1Id),
    side2_entrant_id: normSide(m.player2Id),
    side1_legs: 0,
    side2_legs: 0,
    winner_entrant_id: null,
    loser_entrant_id: null,
    status: "pending",
    next_match_id: m.nextMatchId ? idMap.get(m.nextMatchId) ?? null : null,
    next_loser_match_id: m.nextLoserMatchId ? idMap.get(m.nextLoserMatchId) ?? null : null,
  }))

  // Bye-уудыг шийдвэрлэх: нэг талтай (нөгөө тал нь bye эсвэл хоосон болж дүүрэхгүй)
  // match автоматаар дуусч, ялагч нь дараагийн шатанд дэвшинэ. Round-аар өгсөж
  // боловсруулснаар каскад (bye→bye→...) нэг дамжуулалтаар шийдэгдэнэ.
  const rowById = new Map(rows.map((r) => [r.id, r]))
  const feeders = new Map<string, string[]>() // next_match_id → түүнийг тэжээх match-ууд
  for (const r of rows) {
    if (!r.next_match_id) continue
    const arr = feeders.get(r.next_match_id) ?? []
    arr.push(r.id)
    feeders.set(r.next_match_id, arr)
  }

  const ordered = [...rows].sort((a, b) => a.round - b.round || a.match_number - b.match_number)
  for (const m of ordered) {
    if (m.status === "completed") continue
    // Тэжээгч match дуусаагүй бол эндээс дахин entrant ирж магадгүй — алгасна
    const pendingFeeder = (feeders.get(m.id) ?? []).some((fid) => rowById.get(fid)!.status !== "completed")
    if (pendingFeeder) continue
    const sides = [m.side1_entrant_id, m.side2_entrant_id].filter((s): s is string => !!s)
    if (sides.length === 2) continue // бодит тоглолт — pending хэвээр (онлайн тоглоно)
    // 0 (dead bye-bye) эсвэл 1 (auto-advance) бодит тал
    m.status = "completed"
    m.winner_entrant_id = sides.length === 1 ? sides[0] : null
    if (m.winner_entrant_id && m.next_match_id) {
      const nxt = rowById.get(m.next_match_id)
      if (nxt) {
        if (nxt.side1_entrant_id === null) nxt.side1_entrant_id = m.winner_entrant_id
        else if (nxt.side2_entrant_id === null) nxt.side2_entrant_id = m.winner_entrant_id
      }
    }
  }

  return rows
}
