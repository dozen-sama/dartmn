import { randomUUID } from "node:crypto"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildSingleEliminationRows, type EntrantSeed } from "@/lib/tournament/bracket-server"
import { NextRequest, NextResponse } from "next/server"

// Online тэмцээн эхлүүлэх (зөвхөн зохион байгуулагч). Бүртгэгдсэн (төлбөр төлсөн)
// тоглогчдоос entrant үүсгэж, bracket генерацлаад нэг транзакцид (start_tournament
// RPC) хадгална. Phase 1: single elimination, singles.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, status, type, bracket_type")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (!["draft", "registration"].includes(t.status)) return NextResponse.json({ error: "Тэмцээн аль хэдийн эхэлсэн" }, { status: 409 })
  if (t.bracket_type !== "single_elimination") return NextResponse.json({ error: "Одоогоор зөвхөн шигшээ (single elimination) дэмжигдэнэ" }, { status: 400 })
  if (t.type !== "singles") return NextResponse.json({ error: "Одоогоор зөвхөн singles дэмжигдэнэ" }, { status: 400 })

  // Бүх бүртгэгдсэн тоглогч (off-platform санхүү — платформ төлбөрөөр хаахгүй;
  // хэн оролцохыг зохион байгуулагч removePlayer-ээр зохицуулна)
  const { data: regs } = await admin.from("tournament_registrations")
    .select("player_id, seed, registered_at")
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true, nullsFirst: false })
    .order("registered_at", { ascending: true })
  if (!regs || regs.length < 2) return NextResponse.json({ error: "Хамгийн багадаа 2 оролцогч хэрэгтэй" }, { status: 400 })

  // Нэр харуулахад profiles.username
  const ids = regs.map((r: { player_id: string }) => r.player_id)
  const { data: profs } = await admin.from("profiles").select("id, username").in("id", ids)
  const nameById = new Map<string, string>((profs ?? []).map((p: { id: string; username: string }) => [p.id, p.username]))

  // singles → entrant тус бүр нэг тоглогч; seed нь дарааллаар 1..n
  const entrants = regs.map((r: { player_id: string }, i: number) => {
    const entrantId = randomUUID()
    return {
      row: { id: entrantId, display_name: nameById.get(r.player_id) ?? "Тоглогч", seed: i + 1, group_no: null as number | null },
      players: [{ entrant_id: entrantId, player_id: r.player_id, slot: 0 }],
      seed: { id: entrantId, seed: i + 1 } as EntrantSeed,
    }
  })

  const matches = buildSingleEliminationRows(tournamentId, entrants.map((e: { seed: EntrantSeed }) => e.seed))

  const { error } = await admin.rpc("start_tournament", {
    p_tournament_id: tournamentId,
    p_entrants: entrants.map((e: { row: unknown }) => e.row),
    p_entrant_players: entrants.flatMap((e: { players: unknown[] }) => e.players),
    p_matches: matches,
  })
  if (error) return NextResponse.json({ error: "Тэмцээн эхлүүлэхэд алдаа гарлаа", detail: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, entrants: entrants.length, matches: matches.length })
}
