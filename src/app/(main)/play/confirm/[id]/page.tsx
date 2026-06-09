import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ConfirmResult } from "./ConfirmResult"

export const dynamic = "force-dynamic"

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: pmr } = await supabase
    .from("pending_match_results").select("*").eq("id", id).maybeSingle()
  if (!pmr) notFound()

  const { data: profs } = await supabase
    .from("profiles").select("id, display_name, username").in("id", [pmr.reporter_id, pmr.opponent_id])
  const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
  const nameOf = (uid: string) => byId[uid]?.display_name || byId[uid]?.username || "Тоглогч"

  return (
    <ConfirmResult
      id={pmr.id}
      status={pmr.status}
      isOpponent={user.id === pmr.opponent_id}
      reporterName={nameOf(pmr.reporter_id)}
      opponentName={nameOf(pmr.opponent_id)}
      winnerName={nameOf(pmr.winner_id)}
      iWon={pmr.winner_id === user.id}
    />
  )
}
