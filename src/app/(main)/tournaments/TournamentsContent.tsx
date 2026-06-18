"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { CalendarDays, MapPin, Plus, Search, Trophy, Users, WifiOff } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { mn } from "@/locales/mn"
import { Tournament } from "@/types/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { useLocalGame } from "@/lib/local-game/store"

type TournamentWithRelations = Tournament & {
  profiles: { display_name: string; username: string; avatar_url: string | null } | null
  clubs: { name: string; logo_url: string | null } | null
}

const statusBadge: Record<Tournament["status"], { label: string; class: string }> = {
  draft:        { label: "Ноорог",          class: "bg-muted text-muted-foreground border-0" },
  registration: { label: "Бүртгэл нээлттэй", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ongoing:      { label: "Явагдаж байна",   class: "bg-primary/15 text-primary border-primary/30 pulse-live" },
  completed:    { label: "Дууссан",         class: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled:    { label: "Цуцлагдсан",      class: "bg-destructive/15 text-destructive border-destructive/30" },
}

const formatLabel: Record<string, string> = {
  "501": "501", "301": "301",
}

const BRACKET_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  groups_knockout: "Groups + Knockout",
  swiss: "Swiss",
}

const STATUS_FILTERS = [
  { key: "all", label: "Бүгд" },
  { key: "registration", label: "Бүртгэл" },
  { key: "ongoing", label: "Явагдаж байна" },
  { key: "completed", label: "Дууссан" },
]

interface Props { tournaments: TournamentWithRelations[] }

export function TournamentsContent({ tournaments }: Props) {
  const [search, setSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState("all")
  const [mounted, setMounted] = useState(false)

  const getSummaries = useLocalGame((s) => s.getSummaries)
  useEffect(() => setMounted(true), [])
  const localSessions = mounted ? getSummaries() : []

  const filtered = tournaments.filter((t) => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = activeStatus === "all" || t.status === activeStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Тэмцээн
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Online болон Local тэмцээнүүд</p>
        </div>
        <Link href="/tournaments/new" className={cn(buttonVariants(), "glow-primary shrink-0")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Тэмцээн үүсгэх
        </Link>
      </div>

      {/* Main tabs: Online / Local */}
      <Tabs defaultValue="online">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="online">
            <Trophy className="h-4 w-4 mr-1.5" />
            Online ({tournaments.length})
          </TabsTrigger>
          <TabsTrigger value="local">
            <WifiOff className="h-4 w-4 mr-1.5" />
            Local ({localSessions.length})
          </TabsTrigger>
        </TabsList>

        {/* ── ONLINE ── */}
        <TabsContent value="online" className="mt-4 space-y-4">
          {/* Search + status filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Тэмцээн хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary/50 border-border/60"
              />
            </div>
            {/* Status filter — plain buttons (not nested Tabs) */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveStatus(f.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all whitespace-nowrap",
                    activeStatus === f.key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border bg-secondary/30"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="font-medium text-muted-foreground">{mn.tournament.noTournaments}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Тэмцээн эхлүүлэхэд бэлэн үү?</p>
                <Link href="/tournaments/new" className={cn(buttonVariants(), "mt-5")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Тэмцээн үүсгэх
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((t) => <TournamentCard key={t.id} tournament={t} />)}
            </div>
          )}
        </TabsContent>

        {/* ── LOCAL ── */}
        <TabsContent value="local" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            Local тэмцээн зөвхөн энэ төхөөрөмж дээр хадгалагдана. Интернэт шаардахгүй.
          </div>

          {!mounted ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : localSessions.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <WifiOff className="h-10 w-10 text-muted-foreground/20" />
                <div>
                  <p className="font-semibold text-muted-foreground text-sm">Local тэмцээн байхгүй</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Паб найт, найзуудын тоглолтод ашиглана</p>
                </div>
                <Link href="/local/new" className={cn(buttonVariants(), "mt-1 glow-primary")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Local тэмцээн үүсгэх
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {localSessions.map((s) => {
                const phaseLabel: Record<string, string> = {
                  accepting_entries: "Бүртгэл",
                  making_bracket: "Bracket үүсгэж байна",
                  in_session: "Явагдаж байна",
                  completed: "Дууссан",
                  setup: "Явагдаж байна",
                  group_stage: "Явагдаж байна",
                  knockout: "Явагдаж байна",
                }
                return (
                  <Link key={s.id} href={`/local/${s.id}`}>
                    <Card className="card-hover border-border/50 bg-card/80">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate text-sm">{s.name}</h3>
                              <Badge variant="outline" className={cn(
                                "text-[10px] shrink-0",
                                s.status === "completed"
                                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                                  : "bg-primary/15 text-primary border-primary/30 pulse-live"
                              )}>
                                {s.status === "completed" ? "Дууссан" : (phaseLabel[s.phase] ?? "Явагдаж байна")}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span className="font-medium">{s.format.toUpperCase()}</span>
                              <span>·</span>
                              <span>{BRACKET_LABELS[s.bracketType] ?? s.bracketType}</span>
                              <span>·</span>
                              <span>{s.playerCount} тоглогч</span>
                            </div>
                            {s.status === "completed" && s.winnerName && (
                              <p className="text-xs text-[oklch(0.78_0.16_85)] mt-1 flex items-center gap-1">
                                <Trophy className="h-3 w-3" />{s.winnerName} — Ялагч
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
              <Link href="/local/new" className={cn(buttonVariants({ variant: "outline" }), "w-full border-dashed border-border/50")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Шинэ Local тэмцээн
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TournamentCard({ tournament: t }: { tournament: TournamentWithRelations }) {
  const fillPct = (t.current_players / t.max_players) * 100
  const status = statusBadge[t.status]

  return (
    <Link href={`/tournaments/${t.id}`}>
      <Card className="card-hover border-border/50 bg-card/80 h-full overflow-hidden">
        {t.banner_url && (
          <div className="h-24 bg-gradient-to-r from-primary/20 to-card overflow-hidden relative">
            <Image src={t.banner_url} alt={t.name} fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover opacity-60" />
          </div>
        )}
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{t.name}</h3>
              <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${status.class}`}>
                {status.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatLabel[t.format] ?? t.format}</span>
              {t.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{t.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formatDate(t.start_date)}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />{t.current_players}/{t.max_players} тоглогч
              </span>
              {t.entry_fee > 0 ? (
                <span className="font-semibold text-[oklch(0.78_0.16_85)]">{formatCurrency(t.entry_fee)}</span>
              ) : (
                <span className="text-green-400 font-medium">{mn.common.free}</span>
              )}
            </div>
            <Progress value={fillPct} className="h-1.5" />
          </div>

          {t.prize_pool > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-xs text-muted-foreground">Шагналын сан</span>
              <span className="text-sm font-bold text-[oklch(0.78_0.16_85)]">{formatCurrency(t.prize_pool)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
