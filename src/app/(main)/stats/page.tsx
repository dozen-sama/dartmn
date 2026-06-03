export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BarChart3, Target, Trophy, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatAverage, formatDate, formatNumber } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Statistics" }

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
    .limit(15)

  if (!profile) redirect("/dashboard")

  const winRate = profile.matches_played > 0
    ? (profile.matches_won / profile.matches_played) * 100 : 0
  const lossCount = profile.matches_played - profile.matches_won

  const phases = [
    {
      title: "Match Record",
      icon: Trophy,
      color: "text-primary",
      stats: [
        { label: "Matches Played", value: formatNumber(profile.matches_played), pct: null },
        { label: "Wins", value: profile.matches_won, pct: Math.round(winRate) },
        { label: "Losses", value: lossCount, pct: Math.round(100 - winRate) },
        { label: "Win Rate", value: `${Math.round(winRate)}%`, pct: Math.round(winRate) },
      ],
    },
    {
      title: "Scoring",
      icon: Zap,
      color: "text-blue-400",
      stats: [
        { label: "Average", value: formatAverage(profile.average_score), pct: null },
        { label: "180s", value: formatNumber(profile.count_180), pct: null },
        { label: "Rating Points", value: formatNumber(profile.rating_points), pct: null },
        { label: "Tournament Wins", value: profile.tournament_wins, pct: null },
      ],
    },
    {
      title: "Checkout",
      icon: Target,
      color: "text-green-400",
      stats: [
        { label: "Checkout %", value: `${(profile.checkout_percentage * 100).toFixed(1)}%`, pct: Math.round(profile.checkout_percentage * 100) },
        { label: "Highest Checkout", value: profile.highest_checkout || "—", pct: profile.highest_checkout > 0 ? Math.round((profile.highest_checkout / 170) * 100) : 0 },
        { label: "Best Leg", value: profile.best_leg ? `${profile.best_leg} darts` : "—", pct: profile.best_leg > 0 ? Math.max(0, Math.round(100 - ((profile.best_leg - 9) / 30) * 100)) : 0 },
      ],
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Statistics
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{profile.display_name}-ийн тоглолтын дэлгэрэнгүй</p>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {phases.map((phase) => (
          <Card key={phase.title} className="border-border/50 bg-card/80">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <phase.icon className={`h-4 w-4 ${phase.color}`} />
                {phase.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {phase.stats.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-sm font-bold score-display">{s.value}</span>
                  </div>
                  {s.pct !== null && (
                    <Progress value={s.pct} className="h-1" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Matches Played", value: formatNumber(profile.matches_played), icon: "🎯" },
          { label: "Win Rate", value: `${Math.round(winRate)}%`, icon: "📈" },
          { label: "Highest Checkout", value: profile.highest_checkout || "—", icon: "🎉" },
          { label: "Best Leg", value: profile.best_leg ? `${profile.best_leg}↗` : "—", icon: "⚡" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 bg-card/80 text-center">
            <CardContent className="p-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="text-xl font-bold score-display">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating history */}
      {ratingHistory && ratingHistory.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rating History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ratingHistory.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${entry.change >= 0 ? "bg-green-400" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm capitalize">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.rating_before} → {entry.rating_after} · {formatDate(entry.created_at)}
                  </p>
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
