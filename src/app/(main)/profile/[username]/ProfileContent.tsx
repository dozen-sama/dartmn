"use client"

import Link from "next/link"
import Image from "next/image"
import { BarChart3, Building2, ChevronRight, Edit, MapPin, Pin, Sparkles, Target, Trophy, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mn } from "@/locales/mn"
import { Profile, Tournament, TournamentRegistration } from "@/types/database"
import { formatAverage, formatDate, formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { getTier } from "@/lib/rating"
import { TierBadge } from "@/components/rating/TierBadge"
import { NamePlate } from "@/components/cosmetic/NamePlate"
import { PlayerCard } from "@/components/player/PlayerCard"
import { PlayerAvatar } from "@/components/player/PlayerAvatar"
import { Achievement } from "@/components/achievements/AchievementBadge"
import { NameplateCustomizer } from "@/app/(main)/settings/nameplate/NameplateCustomizer"
import { computeXp, type EffectRow } from "@/lib/cosmetics"

interface Props {
  profile: Profile
  isOwner: boolean
  organizerRating?: { avg: number; count: number; paid: number; unpaid: number }
  clubName: string | null
  history: {
    id: string
    created_at: string
    change: number
    won: boolean | null
    reason: string
    room_id: string | null
    opponent: { display_name: string; username: string } | null
  }[]
  tournaments: (TournamentRegistration & {
    tournaments: Pick<Tournament, "id" | "name" | "status" | "start_date"> | null
  })[]
  allAchievements: Achievement[]
  earnedAchievements: { achievement_key: string; earned_at: string }[]
  ownedEffects: string[]
  effects: (EffectRow & { passActive: boolean })[]
  unlockedFrames: string[]
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

export function ProfileContent({ profile: p, isOwner, organizerRating, clubName, history, tournaments, allAchievements, earnedAchievements, ownedEffects, effects, unlockedFrames }: Props) {
  const winRate = p.matches_played > 0 ? Math.round((p.matches_won / p.matches_played) * 100) : 0
  const lossCount = p.matches_played - p.matches_won
  const tier = getTier(p.rating_points)

  const earnedKeys = earnedAchievements.map((e) => e.achievement_key)
  const earnedMap = Object.fromEntries(earnedAchievements.map((e) => [e.achievement_key, e.earned_at]))
  const achievementsWithDates: Achievement[] = allAchievements.map((a) => ({
    ...a,
    earned_at: earnedMap[a.key],
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile Hero */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/30 via-primary/10 to-card relative">
          {p.cover_url && <Image src={p.cover_url} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover opacity-50" />}
        </div>

        <CardContent className="px-5 pb-5">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <PlayerAvatar
              displayName={p.display_name}
              avatarUrl={p.avatar_url}
              clubLogoUrl={p.primary_club_logo}
              clubTag={p.primary_club_tag}
              size="xl"
              className="border-4 border-background rounded-full"
            />
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
              <div className="text-xl font-bold">
                <NamePlate name={p.display_name} frame={p.equipped_frame} effect={p.name_effect} color={p.name_color} font={p.name_font} animated={p.name_animated} variant="full" />
              </div>
              <TierBadge rating={p.rating_points} avragaWins={p.avraga_wins ?? 0} size="md" />
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
                <span className="font-semibold text-[oklch(0.78_0.16_85)]">{formatNumber(p.rating_points)}</span>
              </span>
              {organizerRating && organizerRating.count > 0 && (
                <span className="flex items-center gap-1" title="Зохион байгуулагчийн үнэлгээ">
                  <span>⭐</span>
                  <span className="font-semibold text-foreground">{organizerRating.avg.toFixed(1)}</span>
                  <span className="text-muted-foreground">({organizerRating.count})</span>
                </span>
              )}
              {organizerRating && (organizerRating.paid > 0 || organizerRating.unpaid > 0) && (
                <span className="flex items-center gap-1.5" title="Шагнал төлөлтийн баталгаа">
                  <span className="text-green-400 font-medium">💰{organizerRating.paid}</span>
                  {organizerRating.unpaid > 0 && <span className="text-destructive font-medium">✗{organizerRating.unpaid}</span>}
                </span>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-5 border-t border-border/50">
            <StatCard label="Тоглолт" value={p.matches_played} />
            <StatCard label="Хожлын хувь" value={`${winRate}%`} sub={`${p.matches_won}Х / ${lossCount}Я`} />
            <StatCard label="180-ийн тоо" value={p.count_180} />
            <StatCard label="Ялалт" value={p.tournament_wins} highlight={p.tournament_wins > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="stats">
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1.5" />Статистик</TabsTrigger>
          {isOwner && <TabsTrigger value="nameplate"><Sparkles className="h-4 w-4 mr-1.5" />Хээ</TabsTrigger>}
          <TabsTrigger value="card">🪪 Карт</TabsTrigger>
          <TabsTrigger value="matches">Түүх</TabsTrigger>
          <TabsTrigger value="tournaments">Тэмцээний түүх</TabsTrigger>
        </TabsList>

        {/* Nameplate customize tab (зөвхөн эзэнд) */}
        {isOwner && (
          <TabsContent value="nameplate" className="mt-4">
            <NameplateCustomizer
              displayName={p.display_name}
              initial={{ frame: p.equipped_frame, effect: p.name_effect, color: p.name_color, font: p.name_font, animated: p.name_animated }}
              unlock={{ rating: p.rating_points, isPremium: p.is_premium }}
              xp={computeXp(p)}
              ownedEffects={ownedEffects}
              effects={effects}
              unlockedFrames={unlockedFrames}
            />
          </TabsContent>
        )}

        {/* Player Card tab */}
        <TabsContent value="card" className="mt-4">
          <div className="flex flex-col items-center gap-4">
            <PlayerCard
              profile={p}
              achievements={achievementsWithDates}
              earnedKeys={earnedKeys}
              clubName={clubName}
            />
            <p className="text-xs text-muted-foreground text-center">
              Screenshot хийж найзуудтайгаа хуваалцаарай
            </p>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Performance */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Performance</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <StatRow label="Match Played" value={formatNumber(p.matches_played)} />
                <StatRow label="Хожлын хувь" value={`${winRate}%`} accent />
                <StatRow label="Дундаж" value={formatAverage(p.average_score)} />
                <StatRow label="Чансааны оноо" value={formatNumber(p.rating_points)} accent />
              </CardContent>
            </Card>

            {/* Checkout & Records */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Records</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <StatRow label="Highest Checkout" value={p.highest_checkout || "—"} accent={p.highest_checkout > 0} />
                <StatRow label="Best Leg" value={p.best_leg ? `${p.best_leg} darts` : "—"} accent={p.best_leg > 0} />
                <StatRow label="180s" value={formatNumber(p.count_180)} accent={p.count_180 > 0} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Target className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Match history байхгүй байна</p>
                </div>
              ) : (
                history.map((h) => {
                  const won = h.won ?? h.change >= 0
                  const inner = (
                    <>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${won ? "bg-green-400" : "bg-destructive"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {h.opponent ? <>vs {h.opponent.display_name}</> : h.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">{h.opponent ? `@${h.opponent.username} · ` : ""}{formatDate(h.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold score-display", h.change >= 0 ? "text-green-400" : "text-destructive")}>
                          {h.change >= 0 ? "+" : ""}{h.change}
                        </p>
                        <Badge variant="outline" className={`text-[10px] ${won ? "border-green-500/30 text-green-400" : "border-destructive/30 text-destructive"}`}>
                          {won ? "Win" : "Loss"}
                        </Badge>
                      </div>
                      {h.room_id && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                    </>
                  )
                  const cls = "flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0"
                  return h.room_id
                    ? <Link key={h.id} href={`/play/${h.room_id}`} className={cn(cls, "hover:bg-secondary/40 transition-colors")}>{inner}</Link>
                    : <div key={h.id} className={cls}>{inner}</div>
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
