import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { TournamentEditForm } from "./TournamentEditForm"
import { Tournament } from "@/types/database"

export const metadata: Metadata = { title: "Тэмцээн засах" }

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single()

  if (!tournament) notFound()
  if (tournament.organizer_id !== user.id) redirect(`/tournaments/${id}`)

  const { data: clubs } = await supabase
    .from("club_members")
    .select("clubs(id, name)")
    .eq("player_id", user.id)
    .in("role", ["owner", "admin"])

  return (
    <TournamentEditForm
      tournament={tournament as Tournament}
      clubs={(clubs?.map((c) => c.clubs).filter(Boolean) ?? []) as unknown as { id: string; name: string }[]}
    />
  )
}
