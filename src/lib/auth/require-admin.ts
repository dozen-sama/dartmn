import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/**
 * Серверийн талд админ эрхийг шалгана.
 * Нэвтрээгүй бол /login, админ биш бол /dashboard руу чиглүүлнэ.
 * Шалгалт давсан тохиолдолд supabase client болон user-г буцаана.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/dashboard")

  return { supabase, user }
}
