"use client"

import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Monitor,
  Target,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { mn } from "@/locales/mn"
import { Profile, Tournament } from "@/types/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface DashboardContentProps {
  profile: Profile | null
  tournaments: (Tournament & {
    profiles: { display_name: string; avatar_url: string | null; username: string } | null
  })[]
  topPlayers: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "rating_points" | "matches_played" | "matches_won">[]
}

const statusColors: Record<Tournament["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

function QuickActionCard({ href, icon: Icon, label, description, color }: {
  href: string
  icon: React.ElementType
  label: string
  description: string
  color: string
}) {
  return (
    <Link href={href}>
      <Card className="card-hover cursor-pointer border-border/50 bg-card/80 h-full">
        <CardContent className="flex items-start gap-4 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function DashboardContent({ profile, tournaments, topPlayers }: DashboardContentProps) {
  const winRate = profile && profile.matches_played > 0
    ? Math.round((profile.matches_won / profile.matches_played) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Hero / Welcome */}
      {profile && (
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/40">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {profile.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-muted-foreground text-sm">Сайн байна уу,</p>
                <h1 className="text-xl font-bold">{profile.display_name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-[oklch(0.78_0.16_85)]" />
                    <span className="text-sm font-semibold text-[oklch(0.78_0.16_85)]">{profile.rating_points} pts</span>
                  </div>
                  <span className="text-border">•</span>
                  <span className="text-xs text-muted-foreground">{profile.matches_played} тоглолт</span>
                </div>
              </div>
            </div>
            <Link href="/play" className={cn(buttonVariants({ size: "sm" }), "glow-primary shrink-0")}>
              <Zap className="h-4 w-4 mr-1.5" />
              Одоо тоглох
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-border/50">
            <div className="text-center">
              <p className="text-2xl font-bold score-display">{profile.matches_won}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Хожил</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold score-display">{winRate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Win rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold score-display">{profile.count_180}</p>
              <p className="text-xs text-muted-foreground mt-0.5">180-ууд</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickActionCard href="/tournaments/create" icon={Trophy} label="Тэмцээн үүсгэх" description="Шинэ тэмцээн зохион байгуулах" color="bg-primary/15 text-primary" />
        <QuickActionCard href="/play" icon={Monitor} label="Онлайн тоглолт" description="Дэлхийн дурын тоглогчтой тоглох" color="bg-blue-500/15 text-blue-400" />
        <QuickActionCard href="/ratings" icon={BarChart3} label="Рейтинг" description="Монголын шилдэг тоглогчид" color="bg-[oklch(0.78_0.16_85)]/15 text-[oklch(0.78_0.16_85)]" />
        <QuickActionCard href="/clubs" icon={Users} label="Клубууд" description="Клубт элсэх эсвэл үүсгэх" color="bg-green-500/15 text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tournaments */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Идэвхтэй тэмцээнүүд
            </h2>
            <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs text-muted-foreground hover:text-foreground")}>
              Бүгдийг харах <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>

          <div className="space-y-2">
            {tournaments.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">{mn.tournament.noTournaments}</p>
                  <Link href="/tournaments/create" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                    {mn.tournament.create}
                  </Link>
                </CardContent>
              </Card>
            ) : (
              tournaments.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <Card className="card-hover border-border/50 bg-card/80">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-sm truncate">{t.name}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statusColors[t.status]}`}>
                            {mn.tournament.status[t.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(t.start_date)}</span>
                          <span>•</span>
                          <span>{t.current_players}/{t.max_players} тоглогч</span>
                          {t.entry_fee > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-[oklch(0.78_0.16_85)]">{formatCurrency(t.entry_fee)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1">
                        <Progress value={(t.current_players / t.max_players) * 100} className="w-16 h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Top Ratings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
              Шилдэг тоглогчид
            </h2>
            <Link href="/ratings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {topPlayers.map((player, i) => (
                <Link
                  key={player.id}
                  href={`/profile/${player.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0"
                >
                  <span className={`text-sm font-bold w-5 text-center score-display ${
                    i === 0 ? "text-[oklch(0.78_0.16_85)]" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={player.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-secondary">
                      {player.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{player.display_name}</p>
                    <p className="text-[11px] text-muted-foreground">@{player.username}</p>
                  </div>
                  <span className="text-sm font-bold score-display text-[oklch(0.78_0.16_85)]">{player.rating_points}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
