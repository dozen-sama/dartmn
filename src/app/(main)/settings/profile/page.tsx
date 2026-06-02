import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfileSettingsForm } from "./ProfileSettingsForm"

export const metadata: Metadata = { title: "Профайл тохиргоо" }

export const dynamic = "force-dynamic"

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/dashboard")

  return <ProfileSettingsForm profile={profile} />
}
