"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarDays, Filter, MapPin, Plus, Search, Target, Trophy, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { mn } from "@/locales/mn"
import { Tournament } from "@/types/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"

type TournamentWithRelations = Tournament & {
  profiles: { display_name: string; username: string; avatar_url: string | null } | null
  clubs: { name: string; logo_url: string | null } | null
}

const statusBadge: Record<Tournament["status"], { label: string; class: string }> = {
  draft: { label: "Ноорог", class: "bg-muted text-muted-foreground border-0" },
  registration: { label: "Бүртгэл нээлттэй", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ongoing: { label: "Явагдаж байна", class: "bg-primary/15 text-primary border-primary/30 pulse-live" },
  completed: { label: "Дууссан", class: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Цуцлагдсан", class: "bg-destructive/15 text-destructive border-destructive/30" },
}

const formatLabel: Record<string, string> = {
  "501": "501",
  "301": "301",
  cricket: "Cricket",
  cutthroat: "Cutthroat",
}

const typeLabel: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
  team: "Багаар",
}

interface Props {
  tournaments: TournamentWithRelations[]
}

export function TournamentsContent({ tournaments }: Props) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  const filtered = tournaments.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = activeTab === "all" || t.status === activeTab
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            {mn.tournament.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tournaments.length} тэмцээн олдлоо
          </p>
        </div>
        <Link href="/tournaments/create" className={cn(buttonVariants(), "glow-primary shrink-0")}>
          <Plus className="h-4 w-4 mr-1.5" />
          {mn.tournament.create}
        </Link>
      </div>

      {/* Filters */}
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all">Бүгд</TabsTrigger>
            <TabsTrigger value="registration">Бүртгэл</TabsTrigger>
            <TabsTrigger value="ongoing">Явагдаж байна</TabsTrigger>
            <TabsTrigger value="completed">Дууссан</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="font-medium text-muted-foreground">{mn.tournament.noTournaments}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Тэмцээн эхлүүлэхэд бэлэн үү?</p>
            <Link href="/tournaments/create" className={cn(buttonVariants(), "mt-5")}>
              <Plus className="h-4 w-4 mr-1.5" />
              {mn.tournament.createFirst}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ tournament: t }: { tournament: TournamentWithRelations }) {
  const fillPct = (t.current_players / t.max_players) * 100
  const status = statusBadge[t.status]

  return (
    <Link href={`/tournaments/${t.id}`}>
      <Card className="card-hover border-border/50 bg-card/80 h-full overflow-hidden">
        {/* Banner placeholder */}
        {t.banner_url && (
          <div className="h-24 bg-gradient-to-r from-primary/20 to-card overflow-hidden">
            <img src={t.banner_url} alt={t.name} className="w-full h-full object-cover opacity-60" />
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Title row */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{t.name}</h3>
              <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${status.class}`}>
                {status.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {formatLabel[t.format]}
              </span>
              <span>{typeLabel[t.type]}</span>
              {t.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {t.location}
                </span>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formatDate(t.start_date)}</span>
          </div>

          {/* Players progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                {t.current_players}/{t.max_players} тоглогч
              </span>
              {t.entry_fee > 0 ? (
                <span className="font-semibold text-gold">{formatCurrency(t.entry_fee)}</span>
              ) : (
                <span className="text-green-400 font-medium">{mn.common.free}</span>
              )}
            </div>
            <Progress value={fillPct} className="h-1.5" />
          </div>

          {/* Prize & organizer */}
          {t.prize_pool > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-xs text-muted-foreground">Шагналын сан</span>
              <span className="text-sm font-bold text-gold">{formatCurrency(t.prize_pool)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
