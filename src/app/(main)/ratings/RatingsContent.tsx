"use client"

import { useState } from "react"
import Link from "next/link"
import { BarChart3, Building2, MapPin, Search, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Profile } from "@/types/database"
import { formatNumber, formatAverage } from "@/lib/utils/format"
import { getTier, TIERS } from "@/lib/rating"
import { PROVINCE_NAMES as MONGOLIAN_PROVINCES } from "@/lib/provinces"
import { PlayerAvatar } from "@/components/player/PlayerAvatar"
import { TierBadge } from "@/components/rating/TierBadge"
import { PlayerName } from "@/components/cosmetic/PlayerName"
import { ClubNamePlate } from "@/components/cosmetic/ClubNamePlate"
import { cn } from "@/lib/utils"

type PlayerRow = Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "rating_points" | "matches_played" | "matches_won" | "average_score" | "count_180" | "highest_checkout" | "city" | "province" | "primary_club_logo" | "primary_club_tag" | "equipped_frame" | "name_effect" | "name_color" | "name_font" | "name_animated">

type ClubRow = {
  id: string
  name: string
  logo_url: string | null
  club_score: number
  member_count: number
  city: string | null
}

interface Props {
  players: PlayerRow[]
  clubs: ClubRow[]
}

// Podium top 3
function Podium({ players }: { players: PlayerRow[] }) {
  const top3 = players.slice(0, 3)
  const order = [1, 0, 2] // 2nd, 1st, 3rd display order

  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {order.map((idx) => {
        const p = top3[idx]
        if (!p) return <div key={idx} className="w-24" />
        const rank = idx + 1
        const tier = getTier(p.rating_points)
        const heights = ["h-20", "h-28", "h-16"]
        const icons = ["🥇", "🥈", "🥉"]

        return (
          <Link key={p.id} href={`/profile/${p.username}`}
            className={cn("flex flex-col items-center gap-2 card-hover rounded-xl p-3 border",
              rank === 1 ? "border-yellow-400/30 bg-yellow-400/5" :
              rank === 2 ? "border-slate-400/30 bg-slate-400/5" :
              "border-amber-700/30 bg-amber-700/5")}>
            <Avatar className={cn("border-2", rank === 1 ? "h-14 w-14 border-yellow-400/50" : "h-10 w-10 border-border")}>
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-secondary text-sm">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-2xl">{icons[idx]}</p>
              <div className={cn("font-bold", rank === 1 ? "text-base" : "text-sm")}><PlayerName p={p} /></div>
              <p className="text-xs text-muted-foreground">@{p.username}</p>
              <TierBadge rating={p.rating_points} size="sm" />
              <p className="text-sm font-bold text-[oklch(0.78_0.16_85)] mt-1 score-display">{formatNumber(p.rating_points)}</p>
            </div>
            {/* Podium block */}
            <div className={cn("w-full rounded-t-md", heights[idx],
              rank === 1 ? "bg-yellow-400/20" : rank === 2 ? "bg-slate-400/20" : "bg-amber-700/20")} />
          </Link>
        )
      })}
    </div>
  )
}

// Player table row
function PlayerRow({ player, rank, showProvince = false }: { player: PlayerRow; rank: number; showProvince?: boolean }) {
  const tier = getTier(player.rating_points)
  const winRate = player.matches_played > 0 ? Math.round((player.matches_won / player.matches_played) * 100) : 0

  return (
    <Link href={`/profile/${player.username}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors border-b border-border/20 last:border-0">
      <span className={cn("text-sm font-bold w-7 text-center score-display shrink-0",
        rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground")}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {player.primary_club_tag && (
            <ClubNamePlate name={player.primary_club_tag} compact className="font-mono shrink-0" />
          )}
          <span className="text-base font-medium"><PlayerName p={player} variant="full" /></span>
          <TierBadge rating={player.rating_points} size="sm" />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          {showProvince && player.province && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />{player.province}
            </span>
          )}
          <span>Дундаж {formatAverage(player.average_score)}</span>
          <span>·</span>
          <span>{winRate}% Хожилт</span>
        </div>
      </div>
      <span className="text-sm font-bold score-display text-[oklch(0.78_0.16_85)] shrink-0">
        {formatNumber(player.rating_points)}
      </span>
    </Link>
  )
}

export function RatingsContent({ players, clubs }: Props) {
  const [search, setSearch] = useState("")
  const [selectedTier, setSelectedTier] = useState<string>("all")
  const [selectedProvince, setSelectedProvince] = useState<string>("all")

  // Filter players
  const filtered = players.filter((p) => {
    const matchSearch = !search || p.display_name.toLowerCase().includes(search.toLowerCase()) || p.username.toLowerCase().includes(search.toLowerCase())
    const matchTier = selectedTier === "all" || getTier(p.rating_points).tier === selectedTier
    const matchProvince = selectedProvince === "all" || p.province === selectedProvince
    return matchSearch && matchTier && matchProvince
  })

  // Province leaderboard: top player per province
  const provinceStats = MONGOLIAN_PROVINCES.map((province) => {
    const provincePlayers = players.filter((p) => p.province === province)
    const avgRating = provincePlayers.length > 0
      ? Math.round(provincePlayers.reduce((a, p) => a + p.rating_points, 0) / provincePlayers.length)
      : 0
    return { province, count: provincePlayers.length, avgRating, top: provincePlayers[0] }
  }).filter((p) => p.count > 0).sort((a, b) => b.avgRating - a.avgRating)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
          Монголын Рейтинг
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">ELO рейтинг · Аймгийн чансаа · Клубын чансаа</p>
      </div>

      <Tabs defaultValue="global">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="global"><Trophy className="h-4 w-4 mr-1.5" />Монголын чансаа</TabsTrigger>
          <TabsTrigger value="province"><MapPin className="h-4 w-4 mr-1.5" />Аймгийн чансаа</TabsTrigger>
          <TabsTrigger value="clubs"><Building2 className="h-4 w-4 mr-1.5" />Клубын чансаа</TabsTrigger>
        </TabsList>

        {/* ── GLOBAL RANKING ── */}
        <TabsContent value="global" className="mt-4 space-y-4">
          {/* Podium */}
          {players.length >= 3 && <Podium players={players} />}

          {/* Tier filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedTier("all")}
              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all",
                selectedTier === "all" ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
              Бүгд
            </button>
            {TIERS.map((t) => (
              <button key={t.tier} onClick={() => setSelectedTier(t.tier)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1",
                  selectedTier === t.tier ? `${t.border} ${t.bg} ${t.color}` : "border-border/50 text-muted-foreground hover:border-border")}>
                <span>{t.icon}</span>{t.tier}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Тоглогч хайх..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/50 border-border/60" />
          </div>

          {/* Province filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><MapPin className="h-3 w-3" /> Аймаг:</span>
            <button onClick={() => setSelectedProvince("all")}
              className={cn("px-2.5 py-1 rounded-md text-xs border transition-all",
                selectedProvince === "all" ? "border-primary bg-primary/15 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
              Бүгд
            </button>
            {MONGOLIAN_PROVINCES.filter((p) => players.some((pl) => pl.province === p)).map((prov) => (
              <button key={prov} onClick={() => setSelectedProvince(prov)}
                className={cn("px-2.5 py-1 rounded-md text-xs border transition-all",
                  selectedProvince === prov ? "border-primary bg-primary/15 text-primary" : "border-border/40 text-muted-foreground hover:border-border")}>
                {prov}
              </button>
            ))}
          </div>

          {/* Table */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {filtered.map((player, i) => (
                <PlayerRow key={player.id} player={player} rank={players.findIndex((p) => p.id === player.id) + 1} showProvince />
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-10 text-sm">Тоглогч олдсонгүй</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PROVINCE RANKING ── */}
        <TabsContent value="province" className="mt-4 space-y-4">
          {/* Province overview grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {provinceStats.map((ps, i) => {
              const tier = ps.top ? getTier(ps.top.rating_points) : null
              return (
                <Card key={ps.province} className="border-border/50 bg-card/80 card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-bold score-display w-6",
                          i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground")}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {ps.province}
                          </p>
                          <p className="text-xs text-muted-foreground">{ps.count} тоглогч</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold score-display text-[oklch(0.78_0.16_85)]">{formatNumber(ps.avgRating)}</p>
                        <p className="text-[10px] text-muted-foreground">дундаж</p>
                      </div>
                    </div>

                    {ps.top && (
                      <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={ps.top.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-secondary">{ps.top.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{ps.top.display_name}</p>
                        </div>
                        {tier && <TierBadge rating={ps.top.rating_points} size="sm" />}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {provinceStats.length === 0 && (
            <Card className="border-dashed border-border/50">
              <CardContent className="py-12 text-center">
                <MapPin className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Аймгийн мэдээлэл байхгүй байна</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Тоглогчид профайлдаа аймгаа оруулах шаардлагатай</p>
              </CardContent>
            </Card>
          )}

          {/* Province player table */}
          {selectedProvince !== "all" && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {selectedProvince} — Топ 100
              </h3>
              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-0">
                  {players.filter((p) => p.province === selectedProvince).slice(0, 100).map((player, i) => (
                    <PlayerRow key={player.id} player={player} rank={i + 1} />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── CLUB RANKING ── */}
        <TabsContent value="clubs" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            Клубын оноо = гишүүдийн дундаж рейтинг. Тоглолт бүрийн дараа автоматаар шинэчлэгдэнэ.
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {clubs.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">Клуб бүртгэлгүй байна</p>
              ) : (
                clubs.map((club, i) => {
                  const tier = getTier(club.club_score)
                  return (
                    <Link key={club.id} href={`/clubs/${club.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors border-b border-border/20 last:border-0">
                      <span className={cn("text-sm font-bold w-7 text-center score-display shrink-0",
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground")}>
                        {i + 1}
                      </span>
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary/60 border border-border/40 flex items-center justify-center overflow-hidden">
                        {club.logo_url
                          ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
                          : <Building2 className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{club.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {club.city && <span>{club.city}</span>}
                          <span>·</span>
                          <span>{club.member_count} гишүүн</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <TierBadge rating={club.club_score} size="sm" />
                        <p className="text-xs font-bold score-display text-[oklch(0.78_0.16_85)] mt-1">{formatNumber(club.club_score)}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
