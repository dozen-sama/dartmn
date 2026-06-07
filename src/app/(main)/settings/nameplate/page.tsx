export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { computeXp, isPassActive, type EffectRow, type PassRow } from "@/lib/cosmetics"
import { NameplateCustomizer } from "./NameplateCustomizer"

export const metadata: Metadata = { title: "Нэрийн хээ — Тохиргоо" }

export default async function NameplateSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: unlocks }, { data: effectsRaw }, { data: passes }] = await Promise.all([
    supabase.from("profiles")
      .select("id, username, display_name, equipped_frame, name_effect, name_color, name_font, name_animated, rating_points, is_premium, matches_played, matches_won, count_180, tournament_wins, avraga_wins")
      .eq("id", user.id).single(),
    supabase.from("player_unlocks").select("item_key").eq("player_id", user.id).eq("item_kind", "effect"),
    supabase.from("cosmetic_effects").select("key, name, lottie_url, xp, fit, scale, scale_y, offset_x, offset_y, scope, pass_id, is_active, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("cosmetic_passes").select("id, name, starts_at, ends_at"),
  ])

  if (!profile) redirect("/login")

  const xp = computeXp(profile)
  const ownedEffects = (unlocks ?? []).map((u) => u.item_key)
  const passMap = new Map((passes ?? []).map((p) => [p.id, p as PassRow]))
  const effects = ((effectsRaw ?? []) as EffectRow[]).map((e) => ({
    ...e,
    passActive: isPassActive(e.pass_id ? passMap.get(e.pass_id) : null),
  }))

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${profile.username}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Нэрийн хээ
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Хүрээ, өнгө, фонтоо тохируул</p>
        </div>
      </div>

      <NameplateCustomizer
        displayName={profile.display_name}
        initial={{
          frame: profile.equipped_frame,
          effect: profile.name_effect,
          color: profile.name_color,
          font: profile.name_font,
          animated: profile.name_animated,
        }}
        unlock={{ rating: profile.rating_points, isPremium: profile.is_premium }}
        xp={xp}
        ownedEffects={ownedEffects}
        effects={effects}
      />
    </div>
  )
}
