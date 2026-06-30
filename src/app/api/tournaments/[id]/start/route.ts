import { randomUUID } from "node:crypto"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildSingleEliminationRows, buildRoundRobinRows, buildGroupsKnockoutRows, buildSwissRows, buildDoubleEliminationRows, isPowerOfTwo, type EntrantSeed, type TournamentMatchRow } from "@/lib/tournament/bracket-server"
import type { GroupStageConfig, EliminationStageConfig, SemiFinalStageConfig } from "@/lib/tournament/stage-types"
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
    .select("id, organizer_id, status, type, bracket_type, groups_count, group_advance, platform_fee, platform_fee_paid, uses_stages, current_stage_id")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (["completed", "cancelled"].includes(t.status)) return NextResponse.json({ error: "Тэмцээн дууссан/цуцлагдсан" }, { status: 409 })
  if (t.platform_fee > 0 && !t.platform_fee_paid) {
    return NextResponse.json({ error: "Платформ шимтгэл төлөгдөөгүй байна" }, { status: 402 })
  }
  if (!t.uses_stages) {
    const SUPPORTED_BRACKETS = ["single_elimination", "round_robin", "groups_knockout", "swiss", "double_elimination"]
    if (!SUPPORTED_BRACKETS.includes(t.bracket_type)) return NextResponse.json({ error: "Энэ bracket төрөл одоогоор дэмжигдэхгүй байна" }, { status: 400 })
  }
  if (t.type !== "singles") return NextResponse.json({ error: "Одоогоор зөвхөн singles дэмжигдэнэ" }, { status: 400 })

  // Bracket аль хэдийн үүссэн бол давхар эхлүүлэхгүй (status ongoing-but-no-matches → сэргээнэ)
  const { count: existingMatches } = await admin.from("tournament_matches")
    .select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId)
  if (existingMatches && existingMatches > 0) return NextResponse.json({ error: "Тэмцээн аль хэдийн эхэлсэн (bracket бий)" }, { status: 409 })

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

  const seeds = entrants.map((e: { seed: EntrantSeed }) => e.seed)
  let matches: TournamentMatchRow[]
  let stageIdForMatches: string | null = null

  if (t.uses_stages) {
    // ── Multi-stage: эхний шатыг л үүсгэнэ ──────────────────────────────────
    const { data: stages } = await admin.from("tournament_stages")
      .select("id, order_no, stage_type, config, status")
      .eq("tournament_id", tournamentId)
      .order("order_no", { ascending: true })
    if (!stages || stages.length === 0) {
      return NextResponse.json({ error: "Олон шатны тохиргоо олдсонгүй" }, { status: 400 })
    }
    const firstStage = stages[0]
    const config = firstStage.config ?? {}
    stageIdForMatches = firstStage.id

    if (firstStage.stage_type === "group") {
      const c = config as GroupStageConfig
      const groupsCount = Math.max(1, c.groups_count ?? 2)
      const advanceCount = Math.max(1, c.advance_count ?? 1)
      if (seeds.length < groupsCount * 2) {
        return NextResponse.json({ error: `${groupsCount} бүлэгт хамгийн багадаа ${groupsCount * 2} оролцогч хэрэгтэй` }, { status: 400 })
      }
      const built = buildGroupsKnockoutRows(tournamentId, seeds, groupsCount, advanceCount)
      // Only group-phase matches (no KO placeholders)
      matches = built.rows.filter((m) => m.group_no != null)
      for (const e of entrants) {
        const gno = built.groupByEntrant[e.row.id]
        if (gno) e.row.group_no = gno
      }
    } else if (firstStage.stage_type === "elimination") {
      const c = config as EliminationStageConfig
      if ((c.max_losses ?? 1) >= 2) {
        if (!isPowerOfTwo(seeds.length)) {
          return NextResponse.json({ error: "Double elimination-д 2-ийн зэрэг тоглогч хэрэгтэй" }, { status: 400 })
        }
        matches = buildDoubleEliminationRows(tournamentId, seeds)
      } else {
        matches = buildSingleEliminationRows(tournamentId, seeds)
      }
    } else if (firstStage.stage_type === "round_robin") {
      matches = buildRoundRobinRows(tournamentId, seeds)
    } else if (firstStage.stage_type === "swiss") {
      matches = buildSwissRows(tournamentId, seeds)
    } else if (firstStage.stage_type === "semifinal") {
      if (seeds.length !== 4) {
        return NextResponse.json({ error: "Хагас финалд яг 4 тоглогч хэрэгтэй" }, { status: 400 })
      }
      matches = buildSingleEliminationRows(tournamentId, seeds)
      // 3-р байрны тоглолт — хагас финалын 2 ялагдагч (дараа seed-лэгдэнэ)
      const c = config as SemiFinalStageConfig
      if (c.has_third_place ?? true) {
        matches.push({
          id: randomUUID(), tournament_id: tournamentId,
          round: 998, match_number: 1,
          is_losers_bracket: false, group_no: null,
          side1_entrant_id: null, side2_entrant_id: null,
          side1_legs: 0, side2_legs: 0,
          winner_entrant_id: null, loser_entrant_id: null,
          status: "pending", next_match_id: null, next_loser_match_id: null,
        })
      }
    } else if (firstStage.stage_type === "final") {
      if (seeds.length !== 2) {
        return NextResponse.json({ error: "Финалд яг 2 тоглогч хэрэгтэй" }, { status: 400 })
      }
      matches = buildSingleEliminationRows(tournamentId, seeds)
    } else {
      return NextResponse.json({ error: "Дэмжигдээгүй шатны төрөл" }, { status: 400 })
    }
  } else {
    // ── Legacy / энгийн bracket ───────────────────────────────────────────────
    if (t.bracket_type === "round_robin") {
      matches = buildRoundRobinRows(tournamentId, seeds)
    } else if (t.bracket_type === "swiss") {
      matches = buildSwissRows(tournamentId, seeds)
    } else if (t.bracket_type === "double_elimination") {
      if (!isPowerOfTwo(seeds.length)) {
        return NextResponse.json({ error: "Double elimination-д оролцогчийн тоо 2-ийн зэрэг байх ёстой (4, 8, 16, 32...)" }, { status: 400 })
      }
      matches = buildDoubleEliminationRows(tournamentId, seeds)
    } else if (t.bracket_type === "groups_knockout") {
      const groupsCount = Math.max(1, t.groups_count ?? 1)
      const advanceCount = Math.max(1, t.group_advance ?? 1)
      if (seeds.length < groupsCount * 2) {
        return NextResponse.json({ error: `${groupsCount} бүлэгт хамгийн багадаа ${groupsCount * 2} оролцогч хэрэгтэй` }, { status: 400 })
      }
      const built = buildGroupsKnockoutRows(tournamentId, seeds, groupsCount, advanceCount)
      matches = built.rows
      for (const e of entrants) {
        const gno = built.groupByEntrant[e.row.id]
        if (gno) e.row.group_no = gno
      }
    } else {
      matches = buildSingleEliminationRows(tournamentId, seeds)
    }
  }

  const { error } = await admin.rpc("start_tournament", {
    p_tournament_id: tournamentId,
    p_entrants: entrants.map((e: { row: unknown }) => e.row),
    p_entrant_players: entrants.flatMap((e: { players: unknown[] }) => e.players),
    p_matches: matches,
  })
  if (error) return NextResponse.json({ error: "Тэмцээн эхлүүлэхэд алдаа гарлаа", detail: error.message }, { status: 500 })

  // Multi-stage: stage_id-г match-д тааруулж, идэвхтэй шатыг тохируулна
  if (stageIdForMatches) {
    const matchIds = matches.map((m) => m.id)
    await Promise.all([
      admin.from("tournament_matches").update({ stage_id: stageIdForMatches }).in("id", matchIds),
      admin.from("tournament_stages").update({ status: "active" }).eq("id", stageIdForMatches),
      admin.from("tournaments").update({ current_stage_id: stageIdForMatches }).eq("id", tournamentId),
    ])
  }

  return NextResponse.json({ ok: true, entrants: entrants.length, matches: matches.length })
}
