import { randomUUID } from "node:crypto"
import { generateSingleElimination, generateRoundRobin, generateGroupsKnockout, generateSwissRound1, generateSwissNextRound } from "@/lib/local-game/bracket"
import type { LocalPlayer, LocalMatch, StandingRow } from "@/lib/local-game/types"
import { computeStandings, seedPositions } from "@/lib/tournament/standings"
import { computePlayInPlan } from "@/lib/tournament/play-in"

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

// Round Robin — бүх хосыг урьдчилан гаргана. Дэвших заагч (next_match_id) байхгүй;
// эрэмбэ нь дууссан match-уудаас тооцсон хүснэгтээр (standings.ts) гарна. Тэмцээн нь
// бүх match дуусахад л дуусна (advance_tournament_match доторх round_robin салбар).
export function buildRoundRobinRows(
  tournamentId: string,
  entrants: EntrantSeed[],
): TournamentMatchRow[] {
  const players: LocalPlayer[] = entrants.map((e) => ({ id: e.id, name: e.id, seed: e.seed }))
  const { matches } = generateRoundRobin(players)

  return matches.map((m) => ({
    id: randomUUID(),
    tournament_id: tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    is_losers_bracket: false,
    group_no: null,
    side1_entrant_id: normSide(m.player1Id),
    side2_entrant_id: normSide(m.player2Id),
    side1_legs: 0,
    side2_legs: 0,
    winner_entrant_id: null,
    loser_entrant_id: null,
    status: "pending",
    next_match_id: null,
    next_loser_match_id: null,
  }))
}

// Groups + Knockout — бүлэг бүрт RR (group_no тэмдэглэгээтэй) + хоосон шигшээ (KO)
// placeholder match-ууд. Бүлгийн шат дуусахад /advance-knockout route нь хүснэгтээс
// дээгүүр N-ийг KO round 1-д суулгана (cross-seed). KO round-ууд next_match_id-аар
// холбогдоно (round >= 100). Group RR матчид group_no = 1..groupsCount.
export function buildGroupsKnockoutRows(
  tournamentId: string,
  entrants: EntrantSeed[],
  groupsCount: number,
  advanceCount: number,
): { rows: TournamentMatchRow[]; groupByEntrant: Record<string, number> } {
  const players: LocalPlayer[] = entrants.map((e) => ({ id: e.id, name: e.id, seed: e.seed }))
  const { matches, groups } = generateGroupsKnockout(players, groupsCount, advanceCount)

  // groupId (текст) → group_no (1..groupsCount); entrant → group_no
  const groupNoById = new Map<string, number>()
  const groupByEntrant: Record<string, number> = {}
  groups.forEach((g, i) => {
    groupNoById.set(g.id, i + 1)
    for (const entrantId of g.playerIds) groupByEntrant[entrantId] = i + 1
  })

  // Генераторын текст id → DB uuid (KO дэх next_match_id холбоход)
  const idMap = new Map<string, string>()
  for (const m of matches) idMap.set(m.id, randomUUID())

  const rows: TournamentMatchRow[] = matches.map((m) => {
    const isKnockout = m.round >= 100
    return {
      id: idMap.get(m.id)!,
      tournament_id: tournamentId,
      round: m.round,
      match_number: m.matchNumber,
      is_losers_bracket: false,
      group_no: isKnockout ? null : (m.groupId ? groupNoById.get(m.groupId) ?? null : null),
      // KO placeholder-ийн талуудыг бүлгийн шат дууссаны дараа seed-лэнэ
      side1_entrant_id: isKnockout ? null : normSide(m.player1Id),
      side2_entrant_id: isKnockout ? null : normSide(m.player2Id),
      side1_legs: 0,
      side2_legs: 0,
      winner_entrant_id: null,
      loser_entrant_id: null,
      status: "pending",
      next_match_id: m.nextMatchId ? idMap.get(m.nextMatchId) ?? null : null,
      next_loser_match_id: null,
    }
  })

  return { rows, groupByEntrant }
}

// Swiss — эхний тойрог (санамсаргүй хослол). Дараагийн тойргуудыг /next-round route
// нь buildSwissNextRoundRows-аар нэмнэ. Дэвших заагчгүй; хүснэгтээр эрэмбэлнэ.
export function buildSwissRows(
  tournamentId: string,
  entrants: EntrantSeed[],
): TournamentMatchRow[] {
  const players: LocalPlayer[] = entrants.map((e) => ({ id: e.id, name: e.id, seed: e.seed }))
  const { matches } = generateSwissRound1(players)
  return matches.map((m) => ({
    id: randomUUID(),
    tournament_id: tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    is_losers_bracket: false,
    group_no: null,
    side1_entrant_id: normSide(m.player1Id),
    side2_entrant_id: normSide(m.player2Id),
    side1_legs: 0,
    side2_legs: 0,
    winner_entrant_id: null,
    loser_entrant_id: null,
    status: "pending",
    next_match_id: null,
    next_loser_match_id: null,
  }))
}

export interface ExistingSwissMatch {
  round: number
  side1_entrant_id: string | null
  side2_entrant_id: string | null
  side1_legs: number
  side2_legs: number
  winner_entrant_id: string | null
  status: "pending" | "ongoing" | "completed"
}

// Swiss дараагийн тойрог: хүснэгт (дууссан match-аас) + давтан хослолоос
// зайлсхийсэн дараагийн тойргийн match-уудыг гаргана. Дууссан тойргийн дараа
// зохион байгуулагч дуудна.
export function buildSwissNextRoundRows(
  tournamentId: string,
  entrants: EntrantSeed[],
  existing: ExistingSwissMatch[],
  currentRound: number,
): TournamentMatchRow[] {
  const entrantIds = entrants.map((e) => e.id)
  const standingArr = computeStandings(entrantIds, existing)
  const standings: Record<string, StandingRow> = {}
  for (const s of standingArr) {
    standings[s.entrantId] = {
      playerId: s.entrantId, played: s.played, won: s.won, lost: s.lost,
      legsWon: s.legsWon, legsLost: s.legsLost, points: s.points,
    }
  }
  // generateSwissNextRound нь зөвхөн player1Id/player2Id-г (давтан илрүүлэх) ашиглана
  const existingLocal = existing.map((e) => ({
    player1Id: e.side1_entrant_id, player2Id: e.side2_entrant_id,
  })) as unknown as LocalMatch[]

  const matches = generateSwissNextRound([], standings, currentRound, existingLocal)
  return matches.map((m) => ({
    id: randomUUID(),
    tournament_id: tournamentId,
    round: m.round,
    match_number: m.matchNumber,
    is_losers_bracket: false,
    group_no: null,
    side1_entrant_id: normSide(m.player1Id),
    side2_entrant_id: normSide(m.player2Id),
    side1_legs: 0,
    side2_legs: 0,
    winner_entrant_id: null,
    loser_entrant_id: null,
    status: "pending",
    next_match_id: null,
    next_loser_match_id: null,
  }))
}

// Double Elimination бүтээх боломжтой мөн үү (клиг тоглолттой ч гэсэн) — зорилтот
// bracket хэмжээ (2-ын доод зэрэг) >= 4 байх ёстой, учир нь k=1 (targetSize=2)
// доройтсон тохиолдол Losers Bracket 0 round үүсгэж, ялагдагч хаашаа ч орох
// боломжгүй болно.
export function isDoubleEliminationEligible(n: number): boolean {
  return computePlayInPlan(n).targetSize >= 4
}

// Double Elimination — local генератор дутуу (losers bracket холбоогүй) тул бүрэн
// логикийг энд бичнэ. DB round дугаар: winners bracket = 1..k, losers bracket =
// 101..(100+2(k-1)) [is_losers_bracket=true], их финал = 200. advance_tournament_match
// RPC нь next_match_id (ялагч)/next_loser_match_id (ялагдагч)-аар дэвшүүлнэ; их финал
// (round 200, losers бус) дуусахад тэмцээн дуусна. Reset (bracket reset) хийхгүй —
// нэг их финал. N нь 2-ын зэрэг биш байж болно (`computePlayInPlan` targetSize-ийг
// доод 2-ын зэрэгт нь буулгаж, илүүдэл оролцогчид клиг (play-in, round=0) тоглолт
// тоглоно — bye-ийн оронд). Клиг тоглолтоор хожигдсон тоглогч WB Round 1-ийн "холбох
// тоглолт" (insertion match)-оор Losers Bracket-руу орно (DE зарчим бүрэн хадгалагдана).
export function buildDoubleEliminationRows(
  tournamentId: string,
  entrants: EntrantSeed[],
): TournamentMatchRow[] {
  const plan = computePlayInPlan(entrants.length)
  const targetSize = plan.targetSize
  const k = Math.log2(targetSize)
  const seeded = [...entrants].sort((a, b) => a.seed - b.seed).map((e) => e.id)

  const rows: TournamentMatchRow[] = []
  let matchNumber = 1
  const mk = (round: number, isLosers: boolean, side1: string | null = null, side2: string | null = null): TournamentMatchRow => {
    const row: TournamentMatchRow = {
      id: randomUUID(), tournament_id: tournamentId, round, match_number: matchNumber++,
      is_losers_bracket: isLosers, group_no: null,
      side1_entrant_id: side1, side2_entrant_id: side2, side1_legs: 0, side2_legs: 0,
      winner_entrant_id: null, loser_entrant_id: null, status: "pending",
      next_match_id: null, next_loser_match_id: null,
    }
    rows.push(row)
    return row
  }

  // ── Клиг (play-in) тоглолтууд — round 0 ──
  const playInMatches: TournamentMatchRow[] = plan.playInPairs.map(([a, b]) =>
    mk(0, false, seeded[a - 1], seeded[b - 1])
  )

  // ── Winners bracket ──
  const order = seedPositions(targetSize) // слот → виртуал seed (1-indexed)
  const slots = order.map((v) => plan.virtualSeedSource[v - 1])
  const wb: TournamentMatchRow[][] = []
  const r1: TournamentMatchRow[] = []
  const r1PlayInFeeders: TournamentMatchRow[][] = []
  for (let i = 0; i < targetSize; i += 2) {
    const s1 = slots[i]
    const s2 = slots[i + 1]
    const side1 = typeof s1 === "number" ? seeded[s1 - 1] : null
    const side2 = typeof s2 === "number" ? seeded[s2 - 1] : null
    const m = mk(1, false, side1, side2)
    const feeders: TournamentMatchRow[] = []
    if (typeof s1 !== "number") { playInMatches[s1.playInIndex].next_match_id = m.id; feeders.push(playInMatches[s1.playInIndex]) }
    if (typeof s2 !== "number") { playInMatches[s2.playInIndex].next_match_id = m.id; feeders.push(playInMatches[s2.playInIndex]) }
    r1PlayInFeeders.push(feeders)
    r1.push(m)
  }
  wb.push(r1)
  // WB ялагчдын замчлал (round r → r+1, floor(i/2))
  for (let r = 2; r <= k; r++) {
    const cur: TournamentMatchRow[] = []
    for (let i = 0; i < wb[r - 2].length; i += 2) cur.push(mk(r, false))
    wb.push(cur)
  }
  for (let r = 1; r < k; r++) {
    wb[r - 1].forEach((m, i) => { m.next_match_id = wb[r][Math.floor(i / 2)].id })
  }

  // ── Их финал ──
  const gf = mk(200, false)
  wb[k - 1][0].next_match_id = gf.id

  // ── Losers bracket ──
  const lbRoundCount = k > 1 ? 2 * (k - 1) : 0
  const lb: TournamentMatchRow[][] = []
  for (let lr = 1; lr <= lbRoundCount; lr++) {
    const j = Math.ceil(lr / 2)
    const count = targetSize / Math.pow(2, j + 1)
    const arr: TournamentMatchRow[] = []
    for (let i = 0; i < count; i++) arr.push(mk(100 + lr, true))
    lb.push(arr)
  }
  // LB дотоод ялагчдын замчлал
  for (let lr = 1; lr < lbRoundCount; lr++) {
    const cur = lb[lr - 1], next = lb[lr]
    const isMinor = lr % 2 === 1 // сондгой = minor (тоо тэнцүү → i→i); тэгш = major (next хагас → floor(i/2))
    cur.forEach((m, i) => { m.next_match_id = next[isMinor ? i : Math.floor(i / 2)].id })
  }
  // LB финал ялагч → их финал
  if (lbRoundCount > 0) lb[lbRoundCount - 1][0].next_match_id = gf.id

  // ── Ялагдагчдын уналт (WB → LB), клиг-тэжээгчийн холбох тоглолт ──
  if (lbRoundCount > 0) {
    // WB R1 ялагдагч → LB R1 match floor(i/2); клиг-тэжээгчтэй бол "холбох тоглолт"
    // (insertion match)-оор дамжуулна (0/1/2 тэжээгчийн тохиолдол).
    wb[0].forEach((m, i) => {
      const target = lb[0][Math.floor(i / 2)]
      const feeders = r1PlayInFeeders[i]
      if (feeders.length === 0) {
        m.next_loser_match_id = target.id
      } else if (feeders.length === 1) {
        const ins = mk(-1, true)
        ins.next_match_id = target.id
        feeders[0].next_loser_match_id = ins.id
        m.next_loser_match_id = ins.id
      } else {
        const ins1 = mk(-1, true)
        const ins2 = mk(-1, true)
        feeders[0].next_loser_match_id = ins1.id
        feeders[1].next_loser_match_id = ins1.id
        ins1.next_match_id = ins2.id
        m.next_loser_match_id = ins2.id
        ins2.next_match_id = target.id
      }
    })
    // WB Rr (2..k) ялагдагч → LB round 2(r-1) match i
    for (let r = 2; r <= k; r++) {
      const target = lb[2 * (r - 1) - 1] // 0-based LB round index
      wb[r - 1].forEach((m, i) => { m.next_loser_match_id = target[i].id })
    }
  }

  return rows
}
