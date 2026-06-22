// Online тэмцээний хүснэгт (round_robin / groups_knockout / swiss)-г
// `tournament_matches`-аас тооцоолно. Хадгалахгүй — sync bug-аас сэргийлнэ
// (local `bracket.ts:updateStandings`-ийн entrant хувилбар). Client + server аль
// алинд аюулгүй (pure).

export interface StandingMatch {
  side1_entrant_id: string | null
  side2_entrant_id: string | null
  side1_legs: number
  side2_legs: number
  winner_entrant_id: string | null
  status: "pending" | "ongoing" | "completed"
  group_no?: number | null
}

export interface EntrantStanding {
  entrantId: string
  played: number
  won: number
  lost: number
  legsWon: number
  legsLost: number
  diff: number
  points: number
}

// entrantIds доторх бүх entrant-д мөр гаргана (тоглоогүй ч 0-оор). Дууссан
// match-уудаас л тооцно. pointWon/pointLost нь тэмцээний тохиргоо (default 2/0).
export function computeStandings(
  entrantIds: string[],
  matches: StandingMatch[],
  pointWon = 2,
  pointLost = 0,
): EntrantStanding[] {
  const rows = new Map<string, EntrantStanding>()
  for (const id of entrantIds) {
    rows.set(id, { entrantId: id, played: 0, won: 0, lost: 0, legsWon: 0, legsLost: 0, diff: 0, points: 0 })
  }

  for (const m of matches) {
    if (m.status !== "completed" || !m.winner_entrant_id) continue
    const s1 = m.side1_entrant_id
    const s2 = m.side2_entrant_id
    if (!s1 || !s2) continue
    const w = rows.get(m.winner_entrant_id)
    const loserId = m.winner_entrant_id === s1 ? s2 : s1
    const l = rows.get(loserId)
    if (!w || !l) continue
    const winLegs = m.winner_entrant_id === s1 ? m.side1_legs : m.side2_legs
    const loseLegs = m.winner_entrant_id === s1 ? m.side2_legs : m.side1_legs
    w.played++; w.won++; w.legsWon += winLegs; w.legsLost += loseLegs; w.points += pointWon
    l.played++; l.lost++; l.legsWon += loseLegs; l.legsLost += winLegs; l.points += pointLost
  }

  const out = [...rows.values()]
  for (const r of out) r.diff = r.legsWon - r.legsLost
  out.sort((a, b) => b.points - a.points || b.diff - a.diff || b.legsWon - a.legsWon)
  return out
}

// Стандарт bracket seeding позиц: size слот бүрт ямар seed (1-indexed) орохыг
// гаргана. Дээд seed нь хамгийн доод seed-тэй (эсвэл bye-тэй) тулна → bye-ууд дээд
// seed-үүдэд хуваарилагдаж, хоосон-хоосон (гацдаг) match үүсэхгүй.
function seedPositions(size: number): number[] {
  let pos = [1]
  while (pos.length < size) {
    const sum = pos.length * 2 + 1
    const next: number[] = []
    for (const p of pos) { next.push(p); next.push(sum - p) }
    pos = next
  }
  return pos
}

// Бүлгийн шат → шигшээ (KO) seed: бүлэг тус бүрийн эрэмбэлсэн entrant-уудаас KO
// round-1-ийн хос гаргана. Нийт seed дараалал нь rank-major (бүх 1-р байр, дараа
// нь бүх 2-р байр ...) — бүлгийн ялагчид илүү дээд seed авна. Стандарт bracket
// slotting-аар байрлуулна: bye-ууд дээд seed-үүдэд оногдоно (гацдаг bye-bye үгүй).
export function seedKnockout(
  rankedByGroup: string[][],
  advanceCount: number,
  koR1Count: number,
): [string | null, string | null][] {
  const size = koR1Count * 2
  const seedOrder: string[] = []
  for (let r = 0; r < advanceCount; r++) {
    for (const g of rankedByGroup) {
      if (g[r]) seedOrder.push(g[r])
    }
  }
  const slots = seedPositions(size) // slot → seed (1-indexed)
  const entrantAt = (slot: number): string | null => {
    const seed = slots[slot]
    return seed != null && seed <= seedOrder.length ? seedOrder[seed - 1] : null
  }
  const pairs: [string | null, string | null][] = []
  for (let i = 0; i < koR1Count; i++) pairs.push([entrantAt(2 * i), entrantAt(2 * i + 1)])
  return pairs
}
