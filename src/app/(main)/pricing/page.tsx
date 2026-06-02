import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PricingContent } from "./PricingContent"

export const metadata: Metadata = { title: "Үнэ тариф" }

export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isPremium = false
  let premiumExpires: string | null = null
  let clubPlan: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .single()

    isPremium = profile?.is_premium ?? false
    premiumExpires = profile?.premium_expires_at ?? null

    const { data: clubMember } = await supabase
      .from("club_members")
      .select("clubs(subscription_plan, subscription_expires_at, name)")
      .eq("player_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .single()

    clubPlan = (clubMember?.clubs as any)?.subscription_plan ?? null
  }

  return (
    <PricingContent
      userId={user?.id ?? null}
      isPremium={isPremium}
      premiumExpires={premiumExpires}
      clubPlan={clubPlan}
    />
  )
}
