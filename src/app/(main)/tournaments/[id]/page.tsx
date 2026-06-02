import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TournamentDetail } from "./TournamentDetail"
import { Profile, Tournament, TournamentRegistration } from "@/types/database"

export const dynamic = "force-dynamic"

type TournamentWithRelations = Tournament & {
  profiles: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  clubs: { id: string; name: string; logo_url: string | null } | null
}

type RegistrationWithProfile = TournamentRegistration & {
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points"> | null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("tournaments").select("name").eq("id", id).single()
  return { title: data?.name ?? "Тэмцээн" }
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tournament }, { data: registrations }] = await Promise.all([
    supabase
      .from("tournaments")
      .select(`
        *,
        profiles!tournaments_organizer_id_fkey(id, display_name, username, avatar_url),
        clubs(id, name, logo_url)
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("tournament_registrations")
      .select("*, profiles(id, display_name, username, avatar_url, rating_points)")
      .eq("tournament_id", id)
      .order("seed", { ascending: true }),
  ])

  if (!tournament) notFound()

  const isRegistered = user
    ? (registrations ?? []).some((r) => r.player_id === user.id)
    : false

  return (
    <TournamentDetail
      tournament={tournament as unknown as TournamentWithRelations}
      registrations={(registrations ?? []) as unknown as RegistrationWithProfile[]}
      currentUserId={user?.id ?? null}
      isRegistered={isRegistered}
    />
  )
}
