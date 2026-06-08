import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { EffectsProvider } from "@/components/cosmetic/EffectsProvider"
import { getActiveEffects } from "@/lib/cosmetics-server"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // getSession() reads from cookie — no network round-trip, ~150ms faster than getUser()
  // Security-sensitive pages (settings, admin) call getUser() themselves
  const { data: { session } } = await supabase.auth.getSession()

  // Профайл (cookie) + cosmetic effects (cache, 5 мин) зэрэг
  const [profileRes, effects] = await Promise.all([
    session?.user
      ? supabase.from("profiles").select("*").eq("id", session.user.id).single()
      : Promise.resolve({ data: null }),
    getActiveEffects(),
  ])
  const profile = profileRes.data

  return (
    <EffectsProvider effects={effects}>
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
    </EffectsProvider>
  )
}
