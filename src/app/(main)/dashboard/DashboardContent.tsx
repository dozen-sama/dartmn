"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, Building2, CalendarCheck, MapPin, Monitor, Target, Trophy, TrendingUp, Users, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { mn } from "@/locales/mn"
import { Profile, Tournament } from "@/types/database"
import { formatCurrency, formatDate, formatNumber, formatAverage } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { PlayerName } from "@/components/cosmetic/PlayerName"

type TournamentWithOrganizer = Tournament & {
  profiles: { display_name: string; avatar_url: string | null; username: string } | null
}

interface DashboardContentProps {
  profile: Profile | null
  todayTournaments: TournamentWithOrganizer[]
  activeTournaments: TournamentWithOrganizer[]
  topPlayers: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "rating_points" | "matches_played" | "matches_won" | "average_score" | "equipped_frame" | "name_effect" | "name_color" | "name_font" | "name_animated">[]
}

const statusColors: Record<Tournament["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30 pulse-live",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

function QuickCard({ href, icon: Icon, label, desc, color }: { href: string; icon: React.ElementType; label: string; desc: string; color: string }) {
  return (
    <Link href={href}>
      <Card className="card-hover cursor-pointer border-border/50 bg-card/80 h-full">
        <CardContent className="flex items-start gap-3 p-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function TournamentRow({ t }: { t: TournamentWithOrganizer }) {
  return (
    <Link href={`/tournaments/${t.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors border-b border-border/30 last:border-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{t.name}</p>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statusColors[t.status]}`}>
              {mn.tournament.status[t.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{formatDate(t.start_date)}</span>
            <span>·</span>
            <span>{t.current_players}/{t.max_players}</span>
            {t.entry_fee > 0 && <><span>·</span><span className="text-[oklch(0.78_0.16_85)]">{formatCurrency(t.entry_fee)}</span></>}
          </div>
        </div>
        <Progress value={(t.current_players / t.max_players) * 100} className="hidden sm:block w-12 h-1.5 shrink-0" />
      </div>
    </Link>
  )
}

export function DashboardContent({ profile, todayTournaments, activeTournaments, topPlayers }: DashboardContentProps) {
  const winRate = profile && profile.matches_played > 0
    ? Math.round((profile.matches_won / profile.matches_played) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Province prompt */}
      {profile && !profile.province && (
        <Link href="/settings/profile"
          className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 hover:bg-yellow-500/10 transition-colors">
          <MapPin className="h-5 w-5 text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-400">Аймгаа тохируулаарай</p>
            <p className="text-xs text-muted-foreground">Аймгийн чансаанд орохын тулд профайлдаа аймгаа сонго</p>
          </div>
          <span className="text-xs text-yellow-400/70 shrink-0">Тохируулах →</span>
        </Link>
      )}

      {/* Hero */}
      {profile && (
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-5 sm:p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/40 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {profile.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-muted-foreground text-sm">Сайн байна уу,</p>
                <h1 className="text-xl font-bold"><PlayerName p={profile} variant="full" /></h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-sm font-semibold text-[oklch(0.78_0.16_85)]">
                    <Trophy className="h-3.5 w-3.5" />
                    {formatNumber(profile.rating_points)} оноо
                  </span>
                  <span className="text-border text-xs">•</span>
                  <span className="text-xs text-muted-foreground">Дундаж: {formatAverage(profile.average_score)}</span>
                </div>
              </div>
            </div>
            <Link href="/play" className={cn(buttonVariants({ size: "sm" }), "glow-primary shrink-0")}>
              <Zap className="h-4 w-4 mr-1.5" />
              Тоглох
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/50">
            {[
              { label: "Тоглолт", value: profile.matches_played },
              { label: "Хожлын хувь", value: `${winRate}%` },
              { label: "Хамгийн өндөр финиш", value: profile.highest_checkout || "—" },
              { label: "180-ийн тоо", value: profile.count_180 },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-lg sm:text-2xl font-bold score-display">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickCard href="/tournaments/create" icon={Trophy} label="Тэмцээн үүсгэх" desc="Шинэ тэмцээн зохион байгуулах" color="bg-primary/15 text-primary" />
        <QuickCard href="/play" icon={Monitor} label="Online тоглолт" desc="Дэлхийн хаанаас ч тоглох" color="bg-blue-500/15 text-blue-400" />
        <QuickCard href="/ratings" icon={BarChart3} label="Рейтинг" desc="Монголын шилдэг тоглогчид" color="bg-[oklch(0.78_0.16_85)]/15 text-[oklch(0.78_0.16_85)]" />
        <QuickCard href="/clubs" icon={Building2} label="Клубууд" desc="Клубт элсэх эсвэл үүсгэх" color="bg-green-500/15 text-green-400" />
      </div>

      {/* Today's Tournaments */}
      {todayTournaments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-base">Өнөөдрийн тэмцээн</h2>
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">{todayTournaments.length}</Badge>
          </div>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-0">
              {todayTournaments.map((t) => <TournamentRow key={t.id} t={t} />)}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tournaments */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Идэвхтэй тэмцээн
            </h2>
            <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs text-muted-foreground")}>
              Бүгдийг харах <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {activeTournaments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">{mn.tournament.noTournaments}</p>
                  <Link href="/tournaments/create" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                    {mn.tournament.create}
                  </Link>
                </div>
              ) : (
                activeTournaments.map((t) => <TournamentRow key={t.id} t={t} />)
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Players */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
              Топ тоглогчид
            </h2>
            <Link href="/ratings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {topPlayers.map((player, i) => {
                const wr = player.matches_played > 0 ? Math.round((player.matches_won / player.matches_played) * 100) : 0
                return (
                  <Link key={player.id} href={`/profile/${player.username}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0">
                    <span className={`text-sm font-bold w-5 text-center score-display ${
                      i === 0 ? "text-[oklch(0.78_0.16_85)]" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                    }`}>{i + 1}</span>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={player.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">{player.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate"><PlayerName p={player} /></p>
                      <p className="text-[11px] text-muted-foreground">Avg {formatAverage(player.average_score)} · {wr}% WR</p>
                    </div>
                    <span className="text-sm font-bold score-display text-[oklch(0.78_0.16_85)]">{formatNumber(player.rating_points)}</span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
