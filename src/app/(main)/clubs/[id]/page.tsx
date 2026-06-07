import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ClubDetail } from "./ClubDetail"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("clubs").select("name").eq("id", id).single()
  return { title: data?.name ?? "Клуб" }
}

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", id)
    .single()

  if (!club) notFound()

  const [membersResult, myMemberResult] = await Promise.all([
    supabase.from("club_members")
      .select("*, profiles(id, display_name, username, avatar_url, rating_points, equipped_frame, name_effect, name_color, name_font, name_animated)")
      .eq("club_id", id)
      .order("role")
      .limit(20),
    user ? supabase.from("club_members")
      .select("role")
      .eq("club_id", id)
      .eq("player_id", user.id)
      .single() : Promise.resolve({ data: null }),
  ])

  return (
    <ClubDetail
      club={club as any}
      members={(membersResult.data ?? []) as any[]}
      currentUserId={user?.id ?? null}
      myRole={myMemberResult.data?.role ?? null}
    />
  )
}
