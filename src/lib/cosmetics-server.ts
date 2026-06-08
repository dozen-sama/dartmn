import "server-only"
import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { EffectRow } from "@/lib/cosmetics"

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
