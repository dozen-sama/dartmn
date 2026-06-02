"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Trophy, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"

interface Tournament {
  id: string
  name: string
  start_date: string
  status: string
  format: string
  type: string
  entry_fee: number
  location: string | null
  tournament_type: string
  current_players: number
  max_players: number
}

const TYPE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  open:     { label: "Нээлттэй", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", dot: "bg-blue-400" },
  league:   { label: "Лиг",       color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  national: { label: "Улсын аварга", color: "bg-primary/15 text-primary border-primary/30", dot: "bg-primary" },
  club:     { label: "Клубын",    color: "bg-green-500/15 text-green-400 border-green-500/30", dot: "bg-green-400" },
  friendly: { label: "Найрсаг",   color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

const MONTH_NAMES = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар",
  "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"]

const WEEK_DAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"]

export function CalendarContent({ tournaments }: { tournaments: Tournament[] }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>("all")

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday=0
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Group tournaments by date string
  const byDate: Record<string, Tournament[]> = {}
  tournaments
    .filter((t) => filterType === "all" || t.tournament_type === filterType)
    .forEach((t) => {
      const d = t.start_date.slice(0, 10)
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(t)
    })

  const selectedKey = selectedDate
  const selectedTournaments = selectedKey ? (byDate[selectedKey] ?? []) : []

  // Upcoming tournaments (next 30 days)
  const upcomingKey = new Date()
  const upcoming = tournaments
    .filter((t) => {
      const d = new Date(t.start_date)
      const diff = (d.getTime() - upcomingKey.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 30 && (filterType === "all" || t.tournament_type === filterType)
    })
    .slice(0, 10)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Тэмцээний календарь
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Монголын дартсын тэмцээн, лиг, улсын аварга</p>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType("all")}
          className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all",
            filterType === "all" ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
          Бүгд
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all",
              filterType === key ? cfg.color : "border-border/50 text-muted-foreground hover:border-border")}>
            {cfg.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="font-bold text-base">{year} оны {MONTH_NAMES[month]}</h2>
                <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Week header */}
              <div className="grid grid-cols-7 mb-1">
                {WEEK_DAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const dayTournaments = byDate[key] ?? []
                  const isToday = key === today.toISOString().slice(0, 10)
                  const isSelected = key === selectedDate
                  const hasTournament = dayTournaments.length > 0

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(isSelected ? null : key)}
                      className={cn(
                        "relative flex flex-col items-center py-1.5 rounded-lg transition-all text-sm min-h-[40px]",
                        isSelected ? "bg-primary/20 ring-1 ring-primary" :
                        isToday ? "bg-secondary ring-1 ring-border" :
                        hasTournament ? "hover:bg-secondary/60" : "hover:bg-secondary/30"
                      )}
                    >
                      <span className={cn("font-medium text-xs", isToday ? "text-primary" : "")}>{day}</span>
                      {hasTournament && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-full">
                          {dayTournaments.slice(0, 3).map((t, ti) => {
                            const cfg = TYPE_CONFIG[t.tournament_type] ?? TYPE_CONFIG.open
                            return <div key={ti} className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-border/40">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                    {cfg.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected date tournaments */}
          {selectedDate && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">{new Date(selectedDate).toLocaleDateString("mn-MN", { month: "long", day: "numeric" })} — Тэмцээнүүд</p>
              {selectedTournaments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Энэ өдөр тэмцээн байхгүй</p>
              ) : (
                selectedTournaments.map((t) => <TournamentCard key={t.id} t={t} />)
              )}
            </div>
          )}
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Удахгүй болох тэмцээн</h3>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">30 хоногт тэмцээн байхгүй</p>
          ) : (
            upcoming.map((t) => <TournamentCard key={t.id} t={t} compact />)
          )}
        </div>
      </div>
    </div>
  )
}

function TournamentCard({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  const typeCfg = TYPE_CONFIG[t.tournament_type] ?? TYPE_CONFIG.open
  const date = new Date(t.start_date)
  const dateStr = date.toLocaleDateString("mn-MN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <Link href={`/tournaments/${t.id}`}>
      <Card className="card-hover border-border/50 bg-card/80">
        <CardContent className={cn("flex items-start gap-3", compact ? "p-3" : "p-4")}>
          {/* Date block */}
          <div className="shrink-0 text-center bg-primary/10 rounded-lg px-2 py-1.5 min-w-[44px]">
            <p className="text-[10px] text-muted-foreground">{date.toLocaleDateString("mn-MN", { month: "short" })}</p>
            <p className="text-lg font-black leading-none text-primary">{date.getDate()}</p>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 mb-1">
              <p className={cn("font-semibold truncate", compact ? "text-xs" : "text-sm")}>{t.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", typeCfg.color)}>
                {typeCfg.label}
              </Badge>
              {!compact && (
                <>
                  <span className="text-[11px] text-muted-foreground">{t.format.toUpperCase()}</span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" />{t.current_players}/{t.max_players}
                  </span>
                  {t.location && (
                    <>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />{t.location}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {!compact && t.entry_fee > 0 && (
              <p className="text-[11px] text-[oklch(0.78_0.16_85)] font-semibold mt-1">{formatCurrency(t.entry_fee)}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
