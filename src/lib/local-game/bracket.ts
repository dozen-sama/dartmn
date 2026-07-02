import { LocalMatch, LocalPlayer, LocalGroup, StandingRow, BracketType } from "./types"

let _idCounter = 0
function newId() { return `m${Date.now()}${++_idCounter}` }
function newGroupId() { return `g${Date.now()}${++_idCounter}` }

// ── Single Elimination ────────────────────────────────────────────
// 3-р байрны тоглолт (round=998, matchNumber=998): 2 semifinal-ийн ялагдагчид
// тоглоно. Semifinal гэдгийг "дараагийн (сүүлийн) финал match-д шууд орох 2
// match" гэж тодорхойлно — bracket-ийн хэмжээнээс үл хамааран зөв ажиллана.
export function generateSingleElimination(players: LocalPlayer[], thirdPlace = false): LocalMatch[] {
  const size = nextPowerOf2(players.length)
  const seeded = [...players].sort((a, b) => a.seed - b.seed)
  const slots: (string | "bye")[] = seeded.map((p) => p.id)
  while (slots.length < size) slots.push("bye")

  const matches: LocalMatch[] = []
  let round = 1
  let matchNumber = 1

  // Round 1
  const r1: LocalMatch[] = []
  for (let i = 0; i < size; i += 2) {
    r1.push(makeMatch(round, matchNumber++, slots[i], slots[i + 1]))
  }
  matches.push(...r1)

  // Subsequent rounds — placeholder matches
  let prev = r1
  let semifinals: LocalMatch[] = []
  while (prev.length > 1) {
    round++
    const next: LocalMatch[] = []
    for (let i = 0; i < prev.length; i += 2) {
      const m = makeMatch(round, matchNumber++, null, null)
      prev[i].nextMatchId = m.id
      prev[i + 1].nextMatchId = m.id
      next.push(m)
    }
    matches.push(...next)
    if (next.length === 1) semifinals = prev
    prev = next
  }

  if (thirdPlace && semifinals.length === 2) {
    // round=998 (matchNumber-ээс үл хамааран) 3-р байрны тоглолтыг бусад round-оос
    // тодорхой ялгаж, "финал"-ийн round grouping-д (bracket render, finalMatch
    // тооцоо) орохоос сэргийлнэ — online-ийн round=998 конвенцтой ижил.
    const bronze = makeMatch(998, matchNumber++, null, null)
    semifinals[0].nextLoserMatchId = bronze.id
    semifinals[1].nextLoserMatchId = bronze.id
    matches.push(bronze)
  }

  return matches
}

// ── Double Elimination ────────────────────────────────────────────
export function generateDoubleElimination(players: LocalPlayer[]): LocalMatch[] {
  // Simplified: generate winners bracket + losers bracket stubs
  const size = nextPowerOf2(players.length)
  const seeded = [...players].sort((a, b) => a.seed - b.seed)
  const slots: (string | "bye")[] = seeded.map((p) => p.id)
  while (slots.length < size) slots.push("bye")

  const matches: LocalMatch[] = []
  let matchNumber = 1

  // Winners bracket round 1
  const wr1: LocalMatch[] = []
  for (let i = 0; i < size; i += 2) {
    const m = makeMatch(1, matchNumber++, slots[i], slots[i + 1])
    wr1.push(m)
  }
  matches.push(...wr1)

  // Winners bracket subsequent
  let wPrev = wr1
  let wRound = 2
  while (wPrev.length > 1) {
    const next: LocalMatch[] = []
    for (let i = 0; i < wPrev.length; i += 2) {
      const m = makeMatch(wRound, matchNumber++, null, null)
      wPrev[i].nextMatchId = m.id
      wPrev[i + 1].nextMatchId = m.id
      next.push(m)
    }
    matches.push(...next)
    wPrev = next
    wRound++
  }

  // Losers bracket stubs (one per winners-bracket loser)
  const lrounds = Math.log2(size) * 2 - 1
  let lMatchNumber = 101
  let lPrev: LocalMatch[] = []
  for (let lr = 1; lr <= lrounds; lr++) {
    const count = lr === 1 ? size / 2 : lPrev.length / (lr % 2 === 0 ? 2 : 1)
    const row: LocalMatch[] = []
    for (let i = 0; i < count; i++) {
      const m = makeMatch(lr, lMatchNumber++, null, null, true)
      row.push(m)
    }
    matches.push(...row)
    lPrev = row
  }

  // Grand final stub
  const gf = makeMatch(99, matchNumber++, null, null)
  gf.matchNumber = 999
  matches.push(gf)

  return matches
}

// ── Round Robin ───────────────────────────────────────────────────
export function generateRoundRobin(players: LocalPlayer[]): { matches: LocalMatch[]; standings: Record<string, StandingRow> } {
  const matches: LocalMatch[] = []
  let matchNumber = 1
  const ids = players.map((p) => p.id)

  if (ids.length % 2 !== 0) ids.push("bye")
  const n = ids.length
  const rounds = n - 1

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const p1 = ids[i]
      const p2 = ids[n - 1 - i]
      if (p1 !== "bye" && p2 !== "bye") {
        matches.push(makeMatch(r + 1, matchNumber++, p1, p2))
      }
    }
    ids.splice(1, 0, ids.pop()!)
  }

  const standings = initStandings(players)
  return { matches, standings }
}

// ── Groups + Knockout ─────────────────────────────────────────────
export function generateGroupsKnockout(
  players: LocalPlayer[],
  groupsCount: number,
  advanceCount: number
): { matches: LocalMatch[]; groups: LocalGroup[]; standings: Record<string, StandingRow> } {
  const groups: LocalGroup[] = []
  const allMatches: LocalMatch[] = []
  let matchNumber = 1

  // Distribute players into groups (snake seeding)
  for (let g = 0; g < groupsCount; g++) {
    groups.push({ id: newGroupId(), name: `Бүлэг ${String.fromCharCode(65 + g)}`, playerIds: [] })
  }
  const sorted = [...players].sort((a, b) => a.seed - b.seed)
  sorted.forEach((p, i) => {
    const g = i % groupsCount
    groups[g < groupsCount ? g : groupsCount - 1].playerIds.push(p.id)
  })

  // Generate RR within each group
  for (const group of groups) {
    const gPlayers = players.filter((p) => group.playerIds.includes(p.id))
    const ids = [...group.playerIds]
    if (ids.length % 2 !== 0) ids.push("bye")
    const n = ids.length
    const rounds = n - 1
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < n / 2; i++) {
        const p1 = ids[i]
        const p2 = ids[n - 1 - i]
        if (p1 !== "bye" && p2 !== "bye") {
          const m = makeMatch(r + 1, matchNumber++, p1, p2)
          m.groupId = group.id
          allMatches.push(m)
        }
      }
      ids.splice(1, 0, ids.pop()!)
    }
  }

  // Knockout placeholder matches (will be filled after group stage)
  const advancingCount = groupsCount * advanceCount
  const koPlayers: (string | null)[] = Array(nextPowerOf2(advancingCount)).fill(null)
  const koSize = koPlayers.length
  let koRound = 100
  let koMatchNumber = 201
  const koR1: LocalMatch[] = []
  for (let i = 0; i < koSize; i += 2) {
    koR1.push(makeMatch(koRound, koMatchNumber++, null, null))
  }
  allMatches.push(...koR1)
  let koPrev = koR1
  koRound++
  while (koPrev.length > 1) {
    const next: LocalMatch[] = []
    for (let i = 0; i < koPrev.length; i += 2) {
      const m = makeMatch(koRound, koMatchNumber++, null, null)
      koPrev[i].nextMatchId = m.id
      koPrev[i + 1].nextMatchId = m.id
      next.push(m)
    }
    allMatches.push(...next)
    koPrev = next
    koRound++
  }

  const standings = initStandings(players)
  return { matches: allMatches, groups, standings }
}

// ── Swiss ─────────────────────────────────────────────────────────
export function generateSwissRound1(players: LocalPlayer[]): { matches: LocalMatch[]; standings: Record<string, StandingRow> } {
  // Round 1: random pairing
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const matches: LocalMatch[] = []
  let matchNumber = 1
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matches.push(makeMatch(1, matchNumber++, shuffled[i].id, shuffled[i + 1].id))
    }
  }
  const standings = initStandings(players)
  return { matches, standings }
}

export function generateSwissNextRound(
  players: LocalPlayer[],
  standings: Record<string, StandingRow>,
  currentRound: number,
  existingMatches: LocalMatch[]
): LocalMatch[] {
  // Pair players with same points, avoid rematches
  const paired = new Set<string>()
  const sorted = Object.values(standings).sort((a, b) => b.points - a.points || b.legsWon - a.legsWon)
  const playedPairs = new Set<string>()
  existingMatches.forEach((m) => {
    if (m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye") {
      playedPairs.add([m.player1Id, m.player2Id].sort().join("|"))
    }
  })

  const matches: LocalMatch[] = []
  let matchNumber = existingMatches.length + 1
  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].playerId)) continue
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].playerId)) continue
      const pairKey = [sorted[i].playerId, sorted[j].playerId].sort().join("|")
      if (!playedPairs.has(pairKey)) {
        matches.push(makeMatch(currentRound + 1, matchNumber++, sorted[i].playerId, sorted[j].playerId))
        paired.add(sorted[i].playerId)
        paired.add(sorted[j].playerId)
        break
      }
    }
  }
  return matches
}

// ── Helpers ───────────────────────────────────────────────────────
function makeMatch(round: number, matchNumber: number, p1: string | "bye" | null, p2: string | "bye" | null, isLosersBracket = false): LocalMatch {
  return {
    id: newId(),
    round,
    matchNumber,
    player1Id: p1,
    player2Id: p2,
    player1Legs: 0,
    player2Legs: 0,
    player1Sets: 0,
    player2Sets: 0,
    winnerId: null,
    loserId: null,
    status: "pending",
    legs: [],
    isLosersBracket,
    nextMatchId: null,
    nextLoserMatchId: null,
  }
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function initStandings(players: LocalPlayer[]): Record<string, StandingRow> {
  const standings: Record<string, StandingRow> = {}
  for (const p of players) {
    standings[p.id] = { playerId: p.id, played: 0, won: 0, lost: 0, legsWon: 0, legsLost: 0, points: 0 }
  }
  return standings
}

// useSets: true бол legsWon/legsLost-д leg-ийн оронд SET дүнг ашиглана (sets горимд
// bracket/standings-ийн diff тооцоолол sets-ээр байх ёстой, online-той ижил дизайн)
export function updateStandings(
  standings: Record<string, StandingRow>,
  match: LocalMatch,
  useSets = false
): Record<string, StandingRow> {
  if (!match.winnerId || !match.loserId) return standings
  const s = { ...standings }
  const w = s[match.winnerId]
  const l = s[match.loserId]
  if (!w || !l) return standings
  const isP1Winner = match.winnerId === match.player1Id
  const winnerScore = useSets
    ? (isP1Winner ? match.player1Sets ?? 0 : match.player2Sets ?? 0)
    : (isP1Winner ? match.player1Legs : match.player2Legs)
  const loserScore = useSets
    ? (isP1Winner ? match.player2Sets ?? 0 : match.player1Sets ?? 0)
    : (isP1Winner ? match.player2Legs : match.player1Legs)
  s[match.winnerId] = { ...w, played: w.played + 1, won: w.won + 1, legsWon: w.legsWon + winnerScore, legsLost: w.legsLost + loserScore, points: w.points + 2 }
  s[match.loserId] = { ...l, played: l.played + 1, lost: l.lost + 1, legsWon: l.legsWon + loserScore, legsLost: l.legsLost + winnerScore }
  return s
}
