import { SupabaseClient } from "@supabase/supabase-js"
import { computeMultiStageFee, computePlatformFee } from "@/lib/tournament/platform-fee"
import type { StageConfig, StageType } from "@/lib/tournament/stage-types"

// Subscription-ийн үнэ зөвхөн серверт мэдэгдэх ёстой — клиентээс ирсэн
// amount-д итгэхгүй, эндээс л бодит үнийг тодорхойлно.
const SUBSCRIPTION_PRICES: Record<string, number> = {
  subscription_premium: 9900,
  subscription_basic: 50000,
  subscription_pro: 100000,
  subscription_enterprise: 250000,
}

// Клиентээс ирсэн `amount`, `purpose`, `tournament_id`-г үндэслэн БОДИТ дүнг
// тооцож буцаана. null буцвал тухайн хүсэлт хүчингүй (татгалзана).
export async function resolveExpectedAmount(
  supabase: SupabaseClient,
  tournamentId: string,
  purpose: string | undefined,
): Promise<number | null> {
  if (purpose && purpose in SUBSCRIPTION_PRICES) {
    return SUBSCRIPTION_PRICES[purpose]
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("entry_fee, bracket_type, max_players, uses_stages")
    .eq("id", tournamentId)
    .maybeSingle()

  if (!tournament) return null

  if (purpose === "platform_fee") {
    // `tournaments.platform_fee` баганад зохион байгуулагч (organizer_id-гаараа
    // RLS-ийн WITH CHECK-гүй "manage" policy-оор) шууд бичиж болдог тул энэ
    // баганад итгэхгүй, үүсгэх үеийн адил дүрмээр серверт ДАХИН тооцно.
    if (tournament.uses_stages) {
      const { data: stages } = await supabase
        .from("tournament_stages")
        .select("stage_type, config")
        .eq("tournament_id", tournamentId)
        .order("order_no", { ascending: true })
      return computeMultiStageFee(
        (stages ?? []) as { stage_type: StageType; config: StageConfig }[],
        tournament.max_players,
      )
    }
    return computePlatformFee(tournament.bracket_type, tournament.max_players)
  }

  if (!purpose) return tournament.entry_fee

  return null
}
