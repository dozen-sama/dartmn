"use client"

import Link from "next/link"
import { BarChart3, Building2, Edit, MapPin, Pin, Target, Trophy, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mn } from "@/locales/mn"
import { Match, Profile, Tournament, TournamentRegistration } from "@/types/database"
import { formatAverage, formatDate, formatNumber, formatPercentage } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface Props {
  profile: Profile
  isOwner: boolean
  clubName: string | null
  recentMatches: (Match & { winner: { display_name: string; username: string } | null })[]
  tournaments: (TournamentRegistration & {
    tournaments: Pick<Tournament, "id" | "name" | "status" | "start_date"> | null
  })[]
}

const MONGOLIAN_PROVINCES = [
  "Улаанбаатар", "Архангай", "Баян-Өлгий", "Баянхонгор", "Булган",
  "Говь-Алтай", "Говьсүмбэр", "Дархан-Уул", "Дорноговь", "Дорнод",
  "Дундговь", "Завхан", "Орхон", "Өвөрхангай", "Өмнөговь",
  "Сүхбаатар", "Сэлэнгэ", "Төв", "Увс", "Ховд", "Хөвсгөл", "Хэнтий",
]

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "text-center space-y-0.5 p-3 rounded-lg",
      highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"
    )}>
      <p className={cn("text-xl font-bold score-display", highlight ? "text-primary" : "")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
    </div>
  )
}

export function ProfileContent({ profile: p, isOwner, clubName, recentMatches, tournaments }: Props) {
  const winRate = p.matches_played > 0 ? Math.round((p.matches_won / p.matches_played) * 100) : 0
  const lossCount = p.matches_played - p.matches_won

  const rankLabel = p.rating_points >= 2000 ? "Мэргэжлийн" :
    p.rating_points >= 1500 ? "Дунд шатны" :
    p.rating_points >= 1000 ? "Анхан шатны" : "Шинэхэн"

  const rankColor = p.rating_points >= 2000 ? "text-[oklch(0.78_0.16_85)] bg-[oklch(0.78_0.16_85)]/15 border-[oklch(0.78_0.16_85)]/30" :
    p.rating_points >= 1500 ? "text-blue-400 bg-blue-500/15 border-blue-500/30" :
    "text-muted-foreground bg-secondary border-border/60"

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile Hero */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/30 via-primary/10 to-card relative">
          {p.cover_url && <img src={p.cover_url} alt="" className="w-full h-full object-cover opacity-50" />}
        </div>

        <CardContent className="px-5 pb-5">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <Avatar className="h-20 w-20 border-4 border-background">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                {p.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOwner ? (
              <Link href="/settings/profile" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-border/60")}>
                <Edit className="h-4 w-4 mr-1.5" />
                Засах
              </Link>
            ) : (
              <Link href={`/play?challenge=${p.username}`} className={cn(buttonVariants({ size: "sm" }), "glow-primary")}>
                <Zap className="h-4 w-4 mr-1.5" />
                Challenge
              </Link>
            )}
          </div>

          {/* Name & info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{p.display_name}</h1>
              <Badge variant="outline" className={`text-xs ${rankColor}`}>{rankLabel}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">@{p.username}</p>

            {p.bio && <p className="text-sm leading-relaxed text-muted-foreground">{p.bio}</p>}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {(p.province || p.city) && (
                <span className="flex items-center gap-1">
                  <Pin className="h-3.5 w-3.5" />
                  {[p.province, p.city].filter(Boolean).join(", ")}
                </span>
              )}
              {clubName && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {clubName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-[oklch(0.78_0.16_85)]" />
                <span className="font-semibold text-[oklch(0.78_0.16_85)]">{formatNumber(p.rating_points)} pts</span>
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-5 border-t border-border/50">
            <StatCard label="Matches" value={p.matches_played} />
            <StatCard label="Win Rate" value={`${winRate}%`} sub={`${p.matches_won}W / ${lossCount}L`} />
            <StatCard label="180s" value={p.count_180} />
            <StatCard label="Titles" value={p.tournament_wins} highlight={p.tournament_wins > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="stats">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1.5" />Statistics</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Performance */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Performance</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <StatRow label="Match Played" value={formatNumber(p.matches_played)} />
                <StatRow label="Win Rate" value={`${winRate}%`} accent />
                <StatRow label="Average" value={formatAverage(p.average_score)} />
                <StatRow label="Rating" value={formatNumber(p.rating_points)} accent />
              </CardContent>
            </Card>

            {/* Checkout & Records */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Records</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <StatRow label="Highest Checkout" value={p.highest_checkout || "—"} accent={p.highest_checkout > 0} />
                <StatRow label="Checkout %" value={formatPercentage(p.checkout_percentage)} />
                <StatRow label="Best Leg" value={p.best_leg ? `${p.best_leg} darts` : "—"} accent={p.best_leg > 0} />
                <StatRow label="180s" value={formatNumber(p.count_180)} accent={p.count_180 > 0} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {recentMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Target className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Match history байхгүй байна</p>
                </div>
              ) : (
                recentMatches.map((match) => {
                  const won = match.winner_id === p.id
                  return (
                    <div key={match.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${won ? "bg-green-400" : "bg-destructive"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{match.format} · BO{match.best_of}</p>
                        <p className="text-xs text-muted-foreground">
                          {match.completed_at ? formatDate(match.completed_at) : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold score-display">{match.player1_legs}–{match.player2_legs}</p>
                        <Badge variant="outline" className={`text-[10px] ${won ? "border-green-500/30 text-green-400" : "border-destructive/30 text-destructive"}`}>
                          {won ? "Win" : "Loss"}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tournaments" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {tournaments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Тэмцээнд оролцоогүй байна</p>
                </div>
              ) : (
                tournaments.map((reg) => (
                  <Link key={reg.id} href={`/tournaments/${reg.tournaments?.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                    <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reg.tournaments?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {reg.tournaments?.start_date ? formatDate(reg.tournaments.start_date) : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      reg.payment_status === "paid" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"
                    }`}>
                      {reg.payment_status === "paid" ? "Бүртгэлтэй" : "Хүлээгдэж байна"}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold score-display", accent ? "text-primary" : "")}>{value}</span>
    </div>
  )
}
