import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// /profile → нэвтэрсэн хэрэглэгчийн өөрийн профайл руу (achievement notification
// зэрэг /profile рүү заадаг линкүүд ажиллана).
export default async function ProfileIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("username").eq("id", user.id).single()
  if (profile?.username) redirect(`/profile/${profile.username}`)
  redirect("/dashboard")
}
