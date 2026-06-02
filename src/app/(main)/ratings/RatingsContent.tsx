"use client"

import { useState } from "react"
import Link from "next/link"
import { BarChart3, Medal, Search, TrendingUp } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Profile } from "@/types/database"
import { formatAverage, formatNumber } from "@/lib/utils/format"
import { mn } from "@/locales/mn"

type PlayerRow = Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "rating_points" | "matches_played" | "matches_won" | "average_score" | "count_180" | "highest_checkout" | "city">

interface Props {
  players: PlayerRow[]
}

const RANK_BADGES: Record<number, { label: string; class: string }> = {
  1: { label: "🥇", class: "text-gold" },
  2: { label: "🥈", class: "text-silver" },
  3: { label: "🥉", class: "text-bronze" },
}

export function RatingsContent({ players }: Props) {
  const [search, setSearch] = useState("")

  const filtered = players.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase())
  )

  const top3 = players.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-gold" />
          {mn.rating.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Монголын шилдэг дартсын тоглогчид</p>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3">
        {top3.map((p, i) => {
          const rank = i + 1
          return (
            <Link key={p.id} href={`/profile/${p.username}`}>
              <Card className={`card-hover border-border/50 text-center overflow-hidden ${
                rank === 1 ? "border-gold/30 bg-gold/5" : "bg-card/80"
              }`}>
                <CardContent className="p-4 space-y-2">
                  <div className="text-2xl">{RANK_BADGES[rank]?.label}</div>
                  <Avatar className={`mx-auto ${rank === 1 ? "h-14 w-14 border-2 border-gold/50" : "h-10 w-10"}`}>
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-xs">
                      {p.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className={`font-semibold truncate ${rank === 1 ? "text-base" : "text-sm"}`}>
                      {p.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                  <p className={`font-bold score-display ${rank === 1 ? "text-xl text-gold" : "text-base text-gold/80"}`}>
                    {formatNumber(p.rating_points)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Тоглогч хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/60"
        />
      </div>

      {/* Full table */}
      <Card className="border-border/50 bg-card/80">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5 w-10">#</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5">Тоглогч</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5">Рейтинг</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5 hidden sm:table-cell">Тоглолт</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5 hidden md:table-cell">Дундаж</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5 hidden md:table-cell">180</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const rank = players.findIndex((pl) => pl.id === p.id) + 1
                const badge = RANK_BADGES[rank]
                const winRate = p.matches_played > 0
                  ? Math.round((p.matches_won / p.matches_played) * 100)
                  : 0

                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/20 last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold score-display ${
                        rank <= 3 ? "text-gold" : "text-muted-foreground"
                      }`}>
                        {rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/profile/${p.username}`} className="flex items-center gap-3 hover:opacity-80">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs bg-secondary">
                            {p.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{p.username}
                            {p.city && <span className="ml-1.5">· {p.city}</span>}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold score-display text-gold">
                        {formatNumber(p.rating_points)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="text-sm score-display">{p.matches_played}</div>
                      <div className="text-[11px] text-muted-foreground">{winRate}% хожил</div>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm score-display">{formatAverage(p.average_score)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm score-display">{p.count_180}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
