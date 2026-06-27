import { createClient, createAdminClient } from "@/lib/supabase/server"
import { buildRoundRobinRows } from "@/lib/tournament/bracket-server"
import { NextRequest, NextResponse } from "next/server"

// Бүлгийн хуваарилалтыг дахин тохируулах: tournament_entrants.group_no шинэчилж,
// бүлгийн match-уудыг устгаад дахин үүсгэнэ. KO bracket хэвээр үлдэнэ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = await createAdminClient()

  const { data: t } = await admin.from("tournaments")
    .select("id, organizer_id, bracket_type")
    .eq("id", tournamentId).single()
  if (!t) return NextResponse.json({ error: "Тэмцээн олдсонгүй" }, { status: 404 })
  if (t.organizer_id !== user.id) return NextResponse.json({ error: "Зөвхөн зохион байгуулагч" }, { status: 403 })
  if (t.bracket_type !== "groups_knockout") return NextResponse.json({ error: "Зөвхөн groups+knockout тэмцээнд" }, { status: 400 })

  // Бүлгийн match аль хэдийн эхэлсэн бол хориглоно
  const { count: startedCount } = await admin.from("tournament_matches")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .not("group_no", "is", null)
    .in("status", ["ongoing", "completed"])
  if (startedCount && startedCount > 0) {
    return NextResponse.json({ error: "Бүлгийн тоглолт аль хэдийн эхэлсэн тул хуваарилалт өөрчлөх боломжгүй" }, { status: 409 })
  }

  const body = await req.json() as { assignments: { entrantId: string; groupNo: number }[] }
  const { assignments } = body
  if (!assignments?.length) return NextResponse.json({ error: "Хуваарилалт хоосон байна" }, { status: 400 })

  // tournament_entrants.group_no шинэчлэх
  for (const { entrantId, groupNo } of assignments) {
    await admin.from("tournament_entrants")
      .update({ group_no: groupNo })
      .eq("id", entrantId)
      .eq("tournament_id", tournamentId)
  }

  // Бүлгийн match-уудыг устгах (group_no IS NOT NULL)
  await admin.from("tournament_matches")
    .delete()
    .eq("tournament_id", tournamentId)
    .not("group_no", "is", null)

  // Шинэ group_no-той entrant-уудыг татаж, бүлэг бүрт RR match үүсгэх
  const { data: entrants } = await admin.from("tournament_entrants")
    .select("id, seed, group_no")
    .eq("tournament_id", tournamentId)

  type Ent = { id: string; seed: number; group_no: number | null }
  const groupMap: Record<number, { id: string; seed: number }[]> = {}
  for (const e of (entrants ?? []) as Ent[]) {
    if (e.group_no == null) continue
    if (!groupMap[e.group_no]) groupMap[e.group_no] = []
    groupMap[e.group_no].push({ id: e.id, seed: e.seed })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newMatches: any[] = []
  for (const [gnoStr, groupEnts] of Object.entries(groupMap)) {
    const gno = parseInt(gnoStr)
    if (groupEnts.length < 2) continue
    const rows = buildRoundRobinRows(tournamentId, groupEnts)
    rows.forEach((r) => { r.group_no = gno })
    newMatches.push(...rows)
  }

  if (newMatches.length > 0) {
    const { error } = await admin.from("tournament_matches").insert(newMatches)
    if (error) return NextResponse.json({ error: "Match үүсгэхэд алдаа", detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, matches: newMatches.length })
}
