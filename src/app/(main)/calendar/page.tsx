import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { CalendarContent } from "./CalendarContent"

export const metadata: Metadata = { title: "Тэмцээний календарь" }

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const supabase = await createClient()

  // Fetch tournaments for next 12 months
  const from = new Date()
  from.setDate(1)
  const to = new Date(from)
  to.setMonth(to.getMonth() + 12)

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, start_date, status, format, type, entry_fee, location, tournament_type, current_players, max_players")
    .gte("start_date", from.toISOString())
    .lte("start_date", to.toISOString())
    .neq("status", "cancelled")
    .order("start_date", { ascending: true })

  return <CalendarContent tournaments={tournaments ?? []} />
}
