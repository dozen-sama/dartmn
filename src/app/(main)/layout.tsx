import { createClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { EffectsProvider } from "@/components/cosmetic/EffectsProvider"
import type { EffectRow } from "@/lib/cosmetics"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // getSession() reads from cookie — no network round-trip, ~150ms faster than getUser()
  // Security-sensitive pages (settings, admin) call getUser() themselves
  const { data: { session } } = await supabase.auth.getSession()

  let profile = null
  if (session?.user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
    profile = data
  }

  // Идэвхтэй cosmetic effect-үүд (NamePlate-д ашиглана)
  const { data: effects } = await supabase
    .from("cosmetic_effects")
    .select("key, name, lottie_url, xp, fit, scale, offset_x, offset_y, scope, pass_id, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order")

  return (
    <EffectsProvider effects={(effects ?? []) as EffectRow[]}>
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
