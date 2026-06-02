import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { redirect } from "next/navigation"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    profile = data
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar profile={profile} />
      <div className="flex flex-1">
        <Sidebar profile={profile} />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
