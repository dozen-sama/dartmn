import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateTournamentForm } from "./CreateTournamentForm"

export const metadata: Metadata = { title: "Тэмцээн үүсгэх" }

export default async function CreateTournamentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: clubs } = await supabase
    .from("club_members")
    .select("clubs(id, name)")
    .eq("player_id", user.id)
    .in("role", ["owner", "admin"])

  return (
    <CreateTournamentForm
      userId={user.id}
      clubs={(clubs?.map((c) => c.clubs).filter(Boolean) ?? []) as unknown as { id: string; name: string }[]}
    />
  )
}
