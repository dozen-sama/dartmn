import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BarChart3, Target, Trophy, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatAverage, formatNumber, formatPercentage } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Статистик" }

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: ratingHistory } = await supabase
    .from("rating_history")
    .select("*")
    .eq("player_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (!profile) redirect("/dashboard")

  const winRate = profile.matches_played > 0
    ? (profile.matches_won / profile.matches_played)
    : 0

  const stats = [
    { label: "Нийт тоглолт", value: formatNumber(profile.matches_played), icon: Target, color: "text-blue-400" },
    { label: "Хожил", value: `${formatNumber(profile.matches_won)} (${Math.round(winRate * 100)}%)`, icon: Trophy, color: "text-green-400" },
    { label: "Рейтинг", value: formatNumber(profile.rating_points), icon: BarChart3, color: "text-gold" },
    { label: "Тэмцээн хожсон", value: formatNumber(profile.tournament_wins), icon: Trophy, color: "text-primary" },
    { label: "Дундаж оноо", value: formatAverage(profile.average_score), icon: Zap, color: "text-purple-400" },
    { label: "Финиш %", value: formatPercentage(profile.checkout_percentage), icon: Target, color: "text-orange-400" },
    { label: "Хамгийн өндөр финиш", value: formatNumber(profile.highest_checkout), icon: Zap, color: "text-yellow-400" },
    { label: "180-ийн тоо", value: formatNumber(profile.count_180), icon: Zap, color: "text-red-400" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Миний статистик
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {profile.display_name}-ийн тоглолтын дэлгэрэнгүй мэдээлэл
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
              <p className={`text-xl font-bold score-display ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating history */}
      {ratingHistory && ratingHistory.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Рейтингийн өөрчлөлт</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ratingHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0"
              >
                <div className={`w-2 h-2 rounded-full ${entry.change >= 0 ? "bg-green-400" : "bg-destructive"}`} />
                <div className="flex-1">
                  <p className="text-sm">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">{entry.rating_before} → {entry.rating_after}</p>
                </div>
                <span className={`text-sm font-bold score-display ${entry.change >= 0 ? "text-green-400" : "text-destructive"}`}>
                  {entry.change >= 0 ? "+" : ""}{entry.change}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
