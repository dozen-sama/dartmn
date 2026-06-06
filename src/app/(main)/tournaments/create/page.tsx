import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CreateTournamentForm } from "./CreateTournamentForm"

export const metadata: Metadata = { title: "Тэмцээн үүсгэх" }

export default async function CreateTournamentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <CreateTournamentForm
      userId={user.id}
      userProfile={profile ?? { display_name: "", username: "", avatar_url: null }}
    />
  )
}
