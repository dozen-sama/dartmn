import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ClubShowcase } from "./ClubShowcase"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("clubs").select("name, tagline").eq("id", id).single()
  return {
    title: data?.name ?? "Клуб",
    description: data?.tagline ?? undefined,
  }
}

export default async function ShowcasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: club } = await supabase
    .from("clubs")
    .select("*, profiles(display_name, username, avatar_url)")
    .eq("id", id)
    .single()

  if (!club) notFound()

  // Only subscribed clubs get showcase
  if (!club.subscription_plan) notFound()

  const { data: members } = await supabase
    .from("club_members")
    .select("role, profiles(id, display_name, username, avatar_url, rating_points)")
    .eq("club_id", id)
    .order("role")
    .limit(12)

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, status, start_date, format, current_players, max_players")
    .eq("club_id", id)
    .in("status", ["registration", "ongoing"])
    .limit(3)

  return (
    <ClubShowcase
      club={club as any}
      members={(members ?? []) as any[]}
      tournaments={(tournaments ?? []) as any[]}
    />
  )
}
