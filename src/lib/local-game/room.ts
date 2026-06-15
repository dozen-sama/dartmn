// Онлайн өрөөний баг/slot тооцоо — routes ба client хоёр хуваалцана.
export type RoomMode = "1v1" | "2v2" | "3v3"

// Баг тус бүрийн тоглогчийн тоо
export function teamSize(mode: RoomMode): number {
  return mode === "1v1" ? 1 : mode === "2v2" ? 2 : 3
}

export function totalPlayers(mode: RoomMode): number {
  return teamSize(mode) * 2
}

// Бүх боломжит {team, slot} байрлал (team 0 ба 1)
export function allSlots(mode: RoomMode): { team: number; slot: number }[] {
  const n = teamSize(mode)
  const out: { team: number; slot: number }[] = []
  for (let team = 0; team < 2; team++) {
    for (let slot = 0; slot < n; slot++) out.push({ team, slot })
  }
  return out
}

// Эзлэгдсэн (room_players + pending invites)-ийг хасаж эхний нээлттэй slot-ийг олно
export function nextOpenSlot(
  mode: RoomMode,
  taken: { team: number; slot: number }[],
): { team: number; slot: number } | null {
  const isTaken = (t: number, s: number) => taken.some((x) => x.team === t && x.slot === s)
  for (const pos of allSlots(mode)) {
    if (!isTaken(pos.team, pos.slot)) return pos
  }
  return null
}

export function slotInBounds(mode: RoomMode, team: number, slot: number): boolean {
  return (team === 0 || team === 1) && slot >= 0 && slot < teamSize(mode)
}
