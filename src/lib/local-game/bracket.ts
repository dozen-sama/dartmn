import { LocalMatch, LocalPlayer, LocalGroup, StandingRow, BracketType } from "./types"
import { seedPositions } from "@/lib/tournament/standings"
import { computePlayInPlan } from "@/lib/tournament/play-in"

// Play-in төлөвлөгөөний виртуал seed-үүдийг стандарт bracket слот дараалал руу
// байрлуулна (слот бүр жинхэнэ seed rank эсвэл клиг тоглолтын индекс заана).
// targetSize = plan.targetSize тул BYE огт үлдэхгүй (илүүдэл нь клиг тоглолт тоглоно).
function round1Slots(plan: ReturnType<typeof computePlayInPlan>): (number | { playInIndex: number })[] {
  const order = seedPositions(plan.targetSize) // слот → виртуал seed (1-indexed)
  return order.map((v) => plan.virtualSeedSource[v - 1])
}

let _idCounter = 0
function newId() { return `m${Date.now()}${++_idCounter}` }
function newGroupId() { return `g${Date.now()}${++_idCounter}` }

// ── Single Elimination ────────────────────────────────────────────
// 3-р байрны тоглолт (round=998, matchNumber=998): 2 semifinal-ийн ялагдагчид
// тоглоно. Semifinal гэдгийг "дараагийн (сүүлийн) финал match-д шууд орох 2
// match" гэж тодорхойлно — bracket-ийн хэмжээнээс үл хамааран зөв ажиллана.
export function generateSingleElimination(players: LocalPlayer[], thirdPlace = false): LocalMatch[] {
  const plan = computePlayInPlan(players.length)
  const seeded = [...players].sort((a, b) => a.seed - b.seed)

  const matches: LocalMatch[] = []
  let round = 1
  let matchNumber = 1

  // Клиг (play-in) тоглолтууд — round 0, доод эрэмбийн илүүдэл тоглогчид
  const playInMatches: LocalMatch[] = plan.playInPairs.map(([a, b]) =>
    makeMatch(0, matchNumber++, seeded[a - 1].id, seeded[b - 1].id)
  )
  matches.push(...playInMatches)

  // Round 1 — виртуал seed-үүдийг стандарт bracket слот руу байрлуулна.
  // Клиг тоглолтоор дүүрэх слот null-аар үүсч, тэр тоглолтын nextMatchId үүнийг заана.
  const slots = round1Slots(plan)
  const r1: LocalMatch[] = []
  for (let i = 0; i < plan.targetSize; i += 2) {
    const s1 = slots[i]
    const s2 = slots[i + 1]
    const p1 = typeof s1 === "number" ? seeded[s1 - 1].id : null
    const p2 = typeof s2 === "number" ? seeded[s2 - 1].id : null
    const m = makeMatch(round, matchNumber++, p1, p2)
    if (typeof s1 !== "number") playInMatches[s1.playInIndex].nextMatchId = m.id
    if (typeof s2 !== "number") playInMatches[s2.playInIndex].nextMatchId = m.id
    r1.push(m)
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
// Winners bracket (round 1..k), Losers bracket (round 100+lr, isLosersBracket=true),
// Их финал (round 200) бүгд бодитоор холбогдоно (WB→LB, LB дотоод, LB final→GF,
// WB final→GF) — bracket-server.ts-ийн buildDoubleEliminationRows-ийн адил алгоритм.
// Play-in (клиг) тоглолт байвал WB Round 1-ийн 0/1/2 клиг-тэжээгчийг "холбох тоглолт"
// (insertion match)-оор LB руу зөв чиглүүлнэ — DE-ийн "2 удаа хожигдсоны дараа
// шалгарна" зарчмыг клиг тоглогчид ч бүрэн хадгална.
export function generateDoubleElimination(players: LocalPlayer[]): LocalMatch[] {
  const plan = computePlayInPlan(players.length)
  const seeded = [...players].sort((a, b) => a.seed - b.seed)
  const targetSize = plan.targetSize
  const k = Math.log2(targetSize)

  const matches: LocalMatch[] = []
  let matchNumber = 1

  // Клиг тоглолтууд — round 0
  const playInMatches: LocalMatch[] = plan.playInPairs.map(([a, b]) =>
    makeMatch(0, matchNumber++, seeded[a - 1].id, seeded[b - 1].id)
  )
  matches.push(...playInMatches)

  // ── Winners bracket ──
  const slots = round1Slots(plan)
  const wb: LocalMatch[][] = []
  const r1: LocalMatch[] = []
  const r1PlayInFeeders: LocalMatch[][] = []
  for (let i = 0; i < targetSize; i += 2) {
    const s1 = slots[i]
    const s2 = slots[i + 1]
    const p1 = typeof s1 === "number" ? seeded[s1 - 1].id : null
    const p2 = typeof s2 === "number" ? seeded[s2 - 1].id : null
    const m = makeMatch(1, matchNumber++, p1, p2)
    const feeders: LocalMatch[] = []
    if (typeof s1 !== "number") { playInMatches[s1.playInIndex].nextMatchId = m.id; feeders.push(playInMatches[s1.playInIndex]) }
    if (typeof s2 !== "number") { playInMatches[s2.playInIndex].nextMatchId = m.id; feeders.push(playInMatches[s2.playInIndex]) }
    r1PlayInFeeders.push(feeders)
    r1.push(m)
  }
  wb.push(r1)
  matches.push(...r1)

  for (let r = 2; r <= k; r++) {
    const cur: LocalMatch[] = []
    for (let i = 0; i < wb[r - 2].length; i += 2) cur.push(makeMatch(r, matchNumber++, null, null))
    wb.push(cur)
    matches.push(...cur)
  }
  for (let r = 1; r < k; r++) {
    wb[r - 1].forEach((m, i) => { m.nextMatchId = wb[r][Math.floor(i / 2)].id })
  }

  // ── Их финал ──
  const gf = makeMatch(200, matchNumber++, null, null)
  matches.push(gf)
  wb[k - 1][0].nextMatchId = gf.id

  // ── Losers bracket ──
  const lbRoundCount = k > 1 ? 2 * (k - 1) : 0
  const lb: LocalMatch[][] = []
  for (let lr = 1; lr <= lbRoundCount; lr++) {
    const j = Math.ceil(lr / 2)
    const count = targetSize / Math.pow(2, j + 1)
    const arr: LocalMatch[] = []
    for (let i = 0; i < count; i++) arr.push(makeMatch(100 + lr, matchNumber++, null, null, true))
    lb.push(arr)
    matches.push(...arr)
  }
  for (let lr = 1; lr < lbRoundCount; lr++) {
    const cur = lb[lr - 1], next = lb[lr]
    const isMinor = lr % 2 === 1 // сондгой = minor (тоо тэнцүү → i→i); тэгш = major (next хагас → floor(i/2))
    cur.forEach((m, i) => { m.nextMatchId = next[isMinor ? i : Math.floor(i / 2)].id })
  }
  if (lbRoundCount > 0) lb[lbRoundCount - 1][0].nextMatchId = gf.id

  // ── Ялагдагчдын уналт (WB → LB), клиг-тэжээгчийн холбох тоглолт ──
  if (lbRoundCount > 0) {
    wb[0].forEach((m, i) => {
      const target = lb[0][Math.floor(i / 2)]
      const feeders = r1PlayInFeeders[i]
      if (feeders.length === 0) {
        m.nextLoserMatchId = target.id
      } else if (feeders.length === 1) {
        // 1 клиг-тэжээгч: клиг-ялагдагч + R1-ийн ялагдагч нэг "холбох тоглолт"-д
        // тулгарч, ялагч нь жинхэнэ LB зорилт руу
        const ins = makeMatch(-1, matchNumber++, null, null, true)
        ins.nextMatchId = target.id
        feeders[0].nextLoserMatchId = ins.id
        m.nextLoserMatchId = ins.id
        matches.push(ins)
      } else {
        // 2 клиг-тэжээгч: эхлээд 2 клиг-ялагдагчийг нэгтгэж, дараа нь R1-ийн
        // ялагдагчтай нэгтгэнэ (гинжилсэн 2 холбох тоглолт)
        const ins1 = makeMatch(-1, matchNumber++, null, null, true)
        const ins2 = makeMatch(-1, matchNumber++, null, null, true)
        feeders[0].nextLoserMatchId = ins1.id
        feeders[1].nextLoserMatchId = ins1.id
        ins1.nextMatchId = ins2.id
        m.nextLoserMatchId = ins2.id
        ins2.nextMatchId = target.id
        matches.push(ins1, ins2)
      }
    })
    for (let r = 2; r <= k; r++) {
      const target = lb[2 * (r - 1) - 1]
      wb[r - 1].forEach((m, i) => { m.nextLoserMatchId = target[i].id })
    }
  }

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
