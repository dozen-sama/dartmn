import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ConfirmResult, type TeamView } from "./ConfirmResult"

export const dynamic = "force-dynamic"

interface PayloadPlayer { profileId: string; team?: number; isWinner: boolean }

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: pmr } = await supabase
    .from("pending_match_results").select("*").eq("id", id).maybeSingle()
  if (!pmr) notFound()

  const payload = (pmr.payload ?? {}) as {
    players?: PayloadPlayer[]; teamNames?: string[]; confirmerIds?: string[]
  }
  const players = payload.players ?? []
  const teamOf = (p: PayloadPlayer, i: number) => p.team ?? i

  // Бүх оролцогч + мэдээлэгчийн нэрсийг татна
  const allIds = [...new Set([pmr.reporter_id, ...players.map((p) => p.profileId)])]
  const { data: profs } = await supabase
    .from("profiles").select("id, display_name, username").in("id", allIds)
  const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
  const nameOf = (uid: string) => byId[uid]?.display_name || byId[uid]?.username || "Тоглогч"

  // Тоглогчдыг багаар нь бүлэглэж харагдац үүсгэнэ (баг тус бүр team ?? индекс)
  const teamMap = new Map<number, { players: string[]; isWinner: boolean }>()
  players.forEach((p, i) => {
    const t = teamOf(p, i)
    const entry = teamMap.get(t) ?? { players: [], isWinner: false }
    entry.players.push(nameOf(p.profileId))
    if (p.isWinner) entry.isWinner = true
    teamMap.set(t, entry)
  })
  const teams: TeamView[] = [...teamMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, e]) => ({
      name: payload.teamNames?.[t] || `Баг ${t + 1}`,
      players: e.players,
      isWinner: e.isWinner,
    }))

  const confirmerIds = payload.confirmerIds ?? [pmr.opponent_id]

  return (
    <ConfirmResult
      id={pmr.id}
      status={pmr.status}
      canConfirm={confirmerIds.includes(user.id)}
      reporterName={nameOf(pmr.reporter_id)}
      teams={teams}
    />
  )
}
