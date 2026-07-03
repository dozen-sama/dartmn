import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database"

export type PracticeMode =
  | "solo501"
  | "checkout_drill"
  | "scoring_drill"
  | "around_clock_singles"
  | "around_clock_doubles"
  | "around_clock_trebles"
  | "bobs27"
  | "checkout121"
  | "cricket"
  | "shanghai"

// Горим бүрийн headline metric аль чиглэлд "сайн" болохыг заана (PB grid-д ашиглана).
export const PRACTICE_PB_DIRECTION: Record<PracticeMode, "higher" | "lower"> = {
  solo501: "higher",
  checkout_drill: "higher",
  scoring_drill: "higher",
  around_clock_singles: "lower",
  around_clock_doubles: "lower",
  around_clock_trebles: "lower",
  bobs27: "higher",
  checkout121: "higher",
  cricket: "lower",
  shanghai: "higher",
}

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  solo501: "Solo 501",
  checkout_drill: "Checkout Drill",
  scoring_drill: "Scoring Drill",
  around_clock_singles: "Around the Clock (Singles)",
  around_clock_doubles: "Around the Clock (Doubles)",
  around_clock_trebles: "Around the Clock (Trebles)",
  bobs27: "Bob's 27",
  checkout121: "121 Checkout",
  cricket: "Cricket Practice",
  shanghai: "Shanghai",
}

export async function savePracticeSession(input: {
  mode: PracticeMode
  headlineMetric: number
  summary: Record<string, unknown>
  durationSeconds?: number
}): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return // нэвтрээгүй/guest бол зүгээр алгасна (match_stat_details-ийн адил зарчим)

  const { error } = await supabase.from("practice_sessions").insert({
    player_id: user.id,
    mode: input.mode,
    headline_metric: input.headlineMetric,
    summary: input.summary as Json,
    duration_seconds: input.durationSeconds ?? null,
  })
  if (error) console.error("practice session save failed", error)
}
