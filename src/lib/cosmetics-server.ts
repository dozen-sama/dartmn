import "server-only"
import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { PROFILE_FRAMES, isFrameUnlocked, type UnlockContext } from "@/lib/frames"
import type { Database } from "@/types/database"
import type { EffectRow } from "@/lib/cosmetics"

/**
 * Хэрэглэгчийн нээгдсэн хүрээнүүд (насан туршийн).
 * Цол/subscription хүрсэн хүрээг player_unlocks-д бүртгэж, дараа нь rating буурсан ч үлдээнэ.
 */
export async function resolveUnlockedFrames(userId: string, ctx: UnlockContext): Promise<string[]> {
  const admin = await createAdminClient()
  const { data } = await admin
    .from("player_unlocks")
    .select("item_key")
    .eq("player_id", userId)
    .eq("item_kind", "frame")
  const owned = new Set((data ?? []).map((r) => r.item_key))

  // Одоо эрхтэй боловч бүртгэгдээгүй хүрээг насан туршид нь бүртгэх
  const toGrant = PROFILE_FRAMES.filter(
    (f) => f.unlock.type !== "free" && !owned.has(f.key) && isFrameUnlocked(f, ctx)
  )
  if (toGrant.length > 0) {
    await admin.from("player_unlocks").upsert(
      toGrant.map((f) => ({ player_id: userId, item_kind: "frame", item_key: f.key })),
      { onConflict: "player_id,item_kind,item_key" }
    )
    toGrant.forEach((f) => owned.add(f.key))
  }
  return [...owned]
}

// Идэвхтэй effect-үүдийг cache-тэйгээр татах (ховор өөрчлөгддөг тул 5 мин cache).
// Cookie/session хэрэггүй (нийтэд унших) тул anon client.
export const getActiveEffects = unstable_cache(
  async (): Promise<EffectRow[]> => {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await sb
      .from("cosmetic_effects")
      .select("key, name, lottie_url, xp, fit, scale, scale_y, offset_x, offset_y, scope, pass_id, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order")
    return (data ?? []) as EffectRow[]
  },
  ["active-cosmetic-effects"],
  { revalidate: 300, tags: ["cosmetic_effects"] }
)
