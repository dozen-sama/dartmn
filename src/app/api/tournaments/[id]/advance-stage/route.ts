import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildSingleEliminationRows, buildRoundRobinRows, buildSwissRows, buildDoubleEliminationRows, buildGroupsKnockoutRows, isDoubleEliminationEligible, type EntrantSeed } from "@/lib/tournament/bracket-server"
import { computeStandings, type StandingMatch } from "@/lib/tournament/standings"
import type { GroupStageConfig, EliminationStageConfig, SemiFinalStageConfig } from "@/lib/tournament/stage-types"
import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

// Multi-stage тэмцээний идэвхтэй шатыг дуусгаж дараагийн шатыг эхлүүлнэ.
// Тоглогчдыг өмнөх шатны хүснэгтээс тодорхойлж дараагийн шатны match-уудыг үүсгэнэ.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, status, uses_stages, current_stage_id")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (!t.uses_stages) return NextResponse.json({ error: "Олон шатны тэмцээн биш" }, { status: 400 })
  if (t.status !== "ongoing") return NextResponse.json({ error: "Тэмцээн идэвхгүй байна" }, { status: 409 })

  const { data: stages } = await admin.from("tournament_stages")
    .select("id, order_no, stage_type, config, status")
    .eq("tournament_id", tournamentId)
    .order("order_no", { ascending: true })
  if (!stages || stages.length === 0) return NextResponse.json({ error: "Шатны мэдээлэл олдсонгүй" }, { status: 404 })

  const currentIdx = stages.findIndex((s: { id: string }) => s.id === t.current_stage_id)
  if (currentIdx < 0) return NextResponse.json({ error: "Идэвхтэй шат олдсонгүй" }, { status: 404 })
  const currentStage = stages[currentIdx]
  const nextStage = stages[currentIdx + 1]
  if (!nextStage) return NextResponse.json({ error: "Сүүлийн шат байна" }, { status: 409 })

  const { data: currentMatches } = await admin.from("tournament_matches")
    .select("id, round, match_number, group_no, is_losers_bracket, side1_entrant_id, side2_entrant_id, side1_legs, side2_legs, winner_entrant_id, status, next_match_id")
    .eq("tournament_id", tournamentId)
    .eq("stage_id", currentStage.id)

  const ms = (currentMatches ?? []) as {
    id: string; round: number; match_number: number; group_no: number | null
    is_losers_bracket: boolean
    side1_entrant_id: string | null; side2_entrant_id: string | null
    side1_legs: number; side2_legs: number; winner_entrant_id: string | null
    status: string; next_match_id: string | null
  }[]

  const unfinished = ms.filter((m) => m.status !== "completed" && (m.side1_entrant_id || m.side2_entrant_id))
  if (unfinished.length > 0) {
    return NextResponse.json({ error: `${unfinished.length} тоглолт дуусаагүй байна` }, { status: 409 })
  }

  // ── Qualified entrant IDs ────────────────────────────────────────────────────
  const config = currentStage.config ?? {}
  let qualifiedIds: string[] = []

  if (currentStage.stage_type === "group") {
    const c = config as GroupStageConfig
    const advanceCount = Math.max(1, c.advance_count ?? 1)

    const { data: entrants } = await admin.from("tournament_entrants")
      .select("id, group_no").eq("tournament_id", tournamentId)
    const ents = (entrants ?? []) as { id: string; group_no: number | null }[]
    const groupNos = [...new Set(ents.map((e) => e.group_no).filter((g): g is number => g != null))].sort((a, b) => a - b)

    for (const gno of groupNos) {
      const gEntrantIds = ents.filter((e) => e.group_no === gno).map((e) => e.id)
      const gMatches = ms.filter((m) => m.group_no === gno)
      const standings = computeStandings(gEntrantIds, gMatches as unknown as StandingMatch[])
      qualifiedIds.push(...standings.slice(0, advanceCount).map((s) => s.entrantId))
    }
  } else if (currentStage.stage_type === "elimination") {
    // Гол bracket-ын финал match-ийн ялагч
    const mainMs = ms.filter((m) => !m.is_losers_bracket && m.round < 200)
    const maxRound = mainMs.length ? Math.max(...mainMs.map((m) => m.round)) : 0
    const finalMs = mainMs.filter((m) => m.round === maxRound)
    qualifiedIds = finalMs.map((m) => m.winner_entrant_id).filter(Boolean) as string[]
  } else if (currentStage.stage_type === "round_robin" || currentStage.stage_type === "swiss") {
    const c = config as { advance_count?: number }
    const advanceCount = Math.max(1, c.advance_count ?? 1)
    const allIds = [...new Set([
      ...ms.map((m) => m.side1_entrant_id),
      ...ms.map((m) => m.side2_entrant_id),
    ].filter(Boolean) as string[])]
    const standings = computeStandings(allIds, ms as unknown as StandingMatch[])
    qualifiedIds = standings.slice(0, advanceCount).map((s) => s.entrantId)
  } else if (currentStage.stage_type === "semifinal") {
    // 2 хагас финалын ялагчид
    const mainMs = ms.filter((m) => m.round !== 998)
    const maxRound = mainMs.length ? Math.max(...mainMs.map((m) => m.round)) : 0
    const semiMs = mainMs.filter((m) => m.round < maxRound)
    qualifiedIds = semiMs.map((m) => m.winner_entrant_id).filter(Boolean) as string[]
  }

  if (qualifiedIds.length < 2) {
    return NextResponse.json({ error: `Дараагийн шатанд хангалттай тоглогч байхгүй (${qualifiedIds.length})` }, { status: 400 })
  }

  // ── Build matches for next stage ─────────────────────────────────────────────
  const nextConfig = nextStage.config ?? {}
  const seeds: EntrantSeed[] = qualifiedIds.map((id, i) => ({ id, seed: i + 1 }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextMatchRows: any[]

  if (nextStage.stage_type === "group") {
    const c = nextConfig as GroupStageConfig
    const groupsCount = Math.max(1, c.groups_count ?? 2)
    const advanceCount = Math.max(1, c.advance_count ?? 1)
    const built = buildGroupsKnockoutRows(tournamentId, seeds, groupsCount, advanceCount)
    const rows = built.rows.filter((m) => m.group_no != null)

    // Update entrant group assignments
    const updates = seeds.map((s) => ({
      id: s.id,
      group_no: built.groupByEntrant[s.id] ?? null,
    }))
    await Promise.all(updates.map((u) =>
      admin.from("tournament_entrants").update({ group_no: u.group_no }).eq("id", u.id).eq("tournament_id", tournamentId)
    ))
    nextMatchRows = rows.map((m) => ({ ...m, stage_id: nextStage.id }))
  } else if (nextStage.stage_type === "elimination") {
    const c = nextConfig as EliminationStageConfig
    let rows
    if ((c.max_losses ?? 1) >= 2) {
      if (!isDoubleEliminationEligible(seeds.length)) {
        return NextResponse.json({ error: "Double elimination-д хамгийн багадаа 3 оролцогч хэрэгтэй" }, { status: 400 })
      }
      rows = buildDoubleEliminationRows(tournamentId, seeds)
    } else {
      rows = buildSingleEliminationRows(tournamentId, seeds)
    }
    nextMatchRows = rows.map((m) => ({ ...m, stage_id: nextStage.id }))
  } else if (nextStage.stage_type === "round_robin") {
    nextMatchRows = buildRoundRobinRows(tournamentId, seeds).map((m) => ({ ...m, stage_id: nextStage.id }))
  } else if (nextStage.stage_type === "swiss") {
    nextMatchRows = buildSwissRows(tournamentId, seeds).map((m) => ({ ...m, stage_id: nextStage.id }))
  } else if (nextStage.stage_type === "semifinal") {
    if (seeds.length !== 4) {
      return NextResponse.json({ error: "Хагас финалд яг 4 тоглогч хэрэгтэй" }, { status: 400 })
    }
    const rows = buildSingleEliminationRows(tournamentId, seeds)
    const c = nextConfig as SemiFinalStageConfig
    if (c.has_third_place ?? true) {
      rows.push({
        id: randomUUID(), tournament_id: tournamentId,
        round: 998, match_number: 1,
        is_losers_bracket: false, group_no: null,
        side1_entrant_id: null, side2_entrant_id: null,
        side1_legs: 0, side2_legs: 0,
        winner_entrant_id: null, loser_entrant_id: null,
        status: "pending", next_match_id: null, next_loser_match_id: null,
      })
    }
    nextMatchRows = rows.map((m) => ({ ...m, stage_id: nextStage.id }))
  } else if (nextStage.stage_type === "final") {
    if (seeds.length !== 2) {
      return NextResponse.json({ error: "Финалд яг 2 тоглогч хэрэгтэй" }, { status: 400 })
    }
    nextMatchRows = buildSingleEliminationRows(tournamentId, seeds).map((m) => ({ ...m, stage_id: nextStage.id }))
  } else {
    return NextResponse.json({ error: "Дэмжигдээгүй шатны төрөл" }, { status: 400 })
  }

  // ── Insert & update ──────────────────────────────────────────────────────────
  const { error: insertErr } = await admin.from("tournament_matches").insert(nextMatchRows)
  if (insertErr) return NextResponse.json({ error: "Match үүсгэхэд алдаа", detail: insertErr.message }, { status: 500 })

  await Promise.all([
    admin.from("tournament_stages").update({ status: "completed" }).eq("id", currentStage.id),
    admin.from("tournament_stages").update({ status: "active" }).eq("id", nextStage.id),
    admin.from("tournaments").update({ current_stage_id: nextStage.id }).eq("id", tournamentId),
  ])

  return NextResponse.json({ ok: true, stage: nextStage.stage_type, matches: nextMatchRows.length })
}
