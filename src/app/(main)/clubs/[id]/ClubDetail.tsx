"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, BarChart3, Building2, Check, Clock, Globe, LogIn, LogOut,
  MapPin, MessageCircle, QrCode, Settings, Share2, Shield, Swords, Target, Trophy, UserCheck, Users, X,
} from "lucide-react"
import { ClubChat } from "./ClubChat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { getTier } from "@/lib/rating"
import { cn } from "@/lib/utils"
import { Club, Profile } from "@/types/database"
import { formatNumber } from "@/lib/utils/format"
import { PlayerName } from "@/components/cosmetic/PlayerName"
import { ClubNamePlate } from "@/components/cosmetic/ClubNamePlate"

type ClubWithExtra = Club & { features: string[] }
type MemberProfile = Pick<Profile,
  "id" | "display_name" | "username" | "avatar_url" | "rating_points" |
  "matches_played" | "matches_won" | "count_180" | "highest_checkout" | "average_score" |
  "equipped_frame" | "name_effect" | "name_color" | "name_font" | "name_animated">
type MemberRow = {
  role: string
  profiles: MemberProfile | null
}
type RequestRow = {
  player_id: string
  created_at: string
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points"> | null
}

interface Props {
  club: ClubWithExtra
  members: MemberRow[]
  requests: RequestRow[]
  currentUserId: string | null
  myRole: string | null
}

const roleLabel: Record<string, string> = { owner: "Удирдагч", admin: "Орлогч", member: "Гишүүн" }
const roleColor: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  admin: "bg-primary/15 text-primary border-primary/30",
  member: "bg-secondary text-muted-foreground",
}

export function ClubDetail({ club, members, requests, currentUserId, myRole }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [joining, setJoining] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin"
  const isMember = !!myRole
  const myPending = !!currentUserId && requests.some((r) => r.player_id === currentUserId)
  const hasSub = !!club.subscription_plan
  const features = Array.isArray(club.features) ? club.features as string[] : []

  async function handleRequestJoin() {
    if (!currentUserId) { router.push("/login"); return }
    setJoining(true)
    const res = await fetch("/api/clubs/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ club_id: club.id }),
    })
    if (res.ok) { toast.success("Элсэх хүсэлт илгээгдлээ — Удирдагч/Орлогч хянана"); router.refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Алдаа гарлаа") }
    setJoining(false)
  }

  async function handleRequest(playerId: string, action: "approve" | "reject") {
    setBusyId(playerId)
    const res = await fetch("/api/clubs/membership", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ club_id: club.id, player_id: playerId, action }),
    })
    if (res.ok) { toast.success(action === "approve" ? "Зөвшөөрлөө" : "Татгалзлаа"); router.refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Алдаа гарлаа") }
    setBusyId(null)
  }

  async function handleLeave() {
    if (!confirm("Клубаас гарах уу?")) return
    const supabase = createClient()
    await supabase.from("club_members").delete().eq("club_id", club.id).eq("player_id", currentUserId!)
    router.refresh()
  }

  function shareClub() {
    navigator.clipboard.writeText(window.location.href)
    toast.success("Холбоос хуулагдлаа")
  }

  async function changeMemberRole(playerId: string, role: "admin" | "member") {
    const res = await fetch("/api/clubs/member-role", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ club_id: club.id, player_id: playerId, role }),
    })
    if (res.ok) { toast.success("Цол шинэчлэгдлээ"); router.refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Алдаа гарлаа") }
  }

  // ── Клубын нэгдсэн статистик (гишүүдийн профайлаас) — бүх хүнд ил тод ──
  const profs = members.map((m) => m.profiles).filter(Boolean) as MemberProfile[]
  const sum = (f: (p: MemberProfile) => number) => profs.reduce((a, p) => a + (f(p) || 0), 0)
  const totalMatches = sum((p) => p.matches_played)
  const totalWins = sum((p) => p.matches_won)
  const total180 = sum((p) => p.count_180)
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0
  const avgRating = profs.length ? Math.round(sum((p) => p.rating_points) / profs.length) : 0
  const bestCheckout = profs.reduce((m, p) => Math.max(m, p.highest_checkout || 0), 0)
  const topPlayer = [...profs].sort((a, b) => b.rating_points - a.rating_points)[0] ?? null
  const statRows = [...profs].sort((a, b) => b.rating_points - a.rating_points)

  // Мэдэгдлээс ?tab=requests гэх мэтээр зөв таб нээх
  const tabParam = searchParams.get("tab")
  const initialTab = tabParam === "requests" && isOwnerOrAdmin ? "requests"
    : tabParam === "stats" ? "stats"
    : tabParam === "chat" ? "chat"
    : "members"

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/clubs" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={shareClub} className="border-border/60">
          <Share2 className="h-3.5 w-3.5 mr-1.5" />
          Хуваалцах
        </Button>
        {isOwnerOrAdmin && (
          <Link href={`/clubs/${club.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-primary/30 text-primary hover:bg-primary/10")}>
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Тохиргоо
          </Link>
        )}
      </div>

      {/* Club hero */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        {club.cover_url && (
          <div className="h-36 overflow-hidden relative">
            <Image src={club.cover_url} alt={club.name} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover opacity-70" />
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl border-2 border-border overflow-hidden bg-secondary/50 shrink-0 flex items-center justify-center">
              {club.logo_url
                ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
                : <Building2 className="h-7 w-7 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">{club.name}</h1>
                {club.tag && (
                  <ClubNamePlate name={club.tag} color={club.tag_color} className="font-mono shrink-0" />
                )}
                {club.is_verified && (
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 shrink-0 text-xs">
                    <Check className="h-2.5 w-2.5 mr-1" />Баталгаажсан
                  </Badge>
                )}
              </div>
              {club.tagline && <p className="text-sm text-muted-foreground mt-1">{club.tagline}</p>}
              {club.description && !club.tagline && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{club.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {club.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{club.city}</span>}
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{club.member_count} гишүүн</span>
                {club.website && (
                  <a href={club.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors">
                    <Globe className="h-3.5 w-3.5" />Вэб
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Features list */}
          {features.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40 space-y-1.5">
              {features.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}

          {/* Join/Leave */}
          <div className="mt-4 flex gap-2">
            {!isMember && currentUserId && (
              myPending ? (
                <Button variant="outline" disabled className="border-amber-500/40 text-amber-400">
                  <Clock className="h-4 w-4 mr-1.5" />
                  Хүсэлт хүлээгдэж байна
                </Button>
              ) : (
                <Button onClick={handleRequestJoin} disabled={joining} className="glow-primary">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  Элсэх хүсэлт илгээх
                </Button>
              )
            )}
            {isMember && myRole !== "owner" && (
              <Button variant="outline" onClick={handleLeave} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-1.5" />
                Гарах
              </Button>
            )}
            {/* Showcase link */}
            {club.subscription_plan && (
              <Link href={`/clubs/${club.id}/showcase`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-border/60")}>
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                Showcase
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Members + Stats + Requests + Chat */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="bg-secondary/50 h-auto flex-wrap justify-start">
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" />Гишүүд ({members.length})</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1.5" />Статистик</TabsTrigger>
          {isOwnerOrAdmin && (
            <TabsTrigger value="requests">
              <UserCheck className="h-4 w-4 mr-1.5" />Хүсэлт
              {requests.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="chat"><MessageCircle className="h-4 w-4 mr-1.5" />Чат</TabsTrigger>
          <TabsTrigger value="war"><Swords className="h-4 w-4 mr-1.5" />Дайн</TabsTrigger>
        </TabsList>

        {/* ── Статистик (бүх хүнд ил тод) ── */}
        <TabsContent value="stats" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { icon: Users, label: "Гишүүд", value: formatNumber(members.length) },
              { icon: Trophy, label: "Нийт хожил", value: formatNumber(totalWins) },
              { icon: Target, label: "Хожлын хувь", value: `${winRate}%` },
              { icon: BarChart3, label: "Дундаж рейтинг", value: formatNumber(avgRating) },
              { icon: Swords, label: "Нийт тоглолт", value: formatNumber(totalMatches) },
              { icon: Target, label: "Нийт 180", value: formatNumber(total180) },
              { icon: Trophy, label: "Дээд checkout", value: bestCheckout || "—" },
              { icon: Shield, label: "Клубын оноо", value: formatNumber(club.club_score) },
            ].map((s, i) => (
              <Card key={i} className="border-border/50 bg-card/80">
                <CardContent className="p-3 text-center">
                  <s.icon className="h-4 w-4 mx-auto text-primary/70 mb-1" />
                  <p className="text-lg font-black score-display leading-none">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {topPlayer && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-3 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground">Клубын тэргүүн тоглогч</p>
                  <p className="text-sm font-bold truncate">{topPlayer.display_name || topPlayer.username}</p>
                </div>
                <p className="text-sm font-black score-display text-yellow-400 shrink-0">{formatNumber(topPlayer.rating_points)}</p>
              </CardContent>
            </Card>
          )}

          {/* Гишүүн бүрийн дэлгэрэнгүй */}
          <Card className="border-border/50 bg-card/80 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <span>Тоглогч</span>
              <span className="w-12 text-right">Чансаа</span>
              <span className="w-14 text-right">Тоглолт</span>
              <span className="w-10 text-right">180</span>
            </div>
            {statRows.map((p) => {
              const wr = p.matches_played > 0 ? Math.round((p.matches_won / p.matches_played) * 100) : 0
              return (
                <Link key={p.id} href={`/profile/${p.username}`}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center text-sm hover:bg-secondary/40 transition-colors border-b border-border/15 last:border-0">
                  <span className="truncate min-w-0">{p.display_name || p.username}</span>
                  <span className="w-12 text-right font-bold score-display text-primary">{formatNumber(p.rating_points)}</span>
                  <span className="w-14 text-right text-muted-foreground text-xs">{p.matches_played} · {wr}%</span>
                  <span className="w-10 text-right text-xs">{p.count_180}</span>
                </Link>
              )
            })}
          </Card>
        </TabsContent>

        {/* ── Элсэх хүсэлтүүд (Удирдагч, Орлогч) ── */}
        {isOwnerOrAdmin && (
          <TabsContent value="requests" className="mt-4">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-0">
                {requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UserCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">Шинэ элсэх хүсэлт алга</p>
                  </div>
                ) : (
                  requests.map((r) => {
                    const p = r.profiles
                    if (!p) return null
                    const tier = getTier(p.rating_points)
                    return (
                      <div key={r.player_id} className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0">
                        <Link href={`/profile/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback>{(p.display_name || p.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.display_name || p.username}</p>
                            <p className="text-xs text-muted-foreground">@{p.username} · <span className={tier.color}>{tier.icon} {formatNumber(p.rating_points)}</span></p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link href={`/profile/${p.username}`}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 border-border/60 text-xs")}>
                            Профайл
                          </Link>
                          <button onClick={() => handleRequest(r.player_id, "reject")} disabled={busyId === r.player_id}
                            className="h-8 w-8 flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40" title="Татгалзах">
                            <X className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleRequest(r.player_id, "approve")} disabled={busyId === r.player_id}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40" title="Зөвшөөрөх">
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="war" className="mt-4">
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-b from-primary/5 to-transparent overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center px-5">
              <div className="relative mb-4">
                <Swords className="h-14 w-14 text-primary" />
                <span className="absolute -top-1 -right-2 text-xl animate-pulse">⚔️</span>
              </div>
              <Badge className="bg-primary/15 text-primary border-primary/30 mb-3">Тун удахгүй</Badge>
              <h3 className="text-lg font-bold mb-2">Клубын Дайн (Club War)</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Клубууд хоорондоо ELO-оор тааруулсан тоглогчдоор <span className="text-foreground font-medium">BO3</span> тулаан хийж,
                ялагч нь <span className="text-foreground font-medium">клубын оноо, цом, зэрэглэл</span> цуглуулна.
              </p>
              <div className="grid grid-cols-1 gap-2 mt-5 w-full max-w-xs text-left">
                {[
                  ["👥", "10+ гишүүнтэй клуб дайн зарлана"],
                  ["🎖", "Удирдагч, Орлогч нар удирдана"],
                  ["⚡", "ELO-оор хослуулсан 1v1 тулаанууд"],
                  ["🕐", "24ц бэлтгэл — тоглогчид цагаа тохирно"],
                ].map(([icon, txt]) => (
                  <div key={txt} className="flex items-center gap-2.5 bg-secondary/40 rounded-lg px-3 py-2">
                    <span className="text-base shrink-0">{icon}</span>
                    <span className="text-xs text-muted-foreground">{txt}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-5">
                🚧 Онлайн тоглолт нэвтэрсний дараа идэвхжинэ. Бэлэн байгаарай!
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {!hasSub ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-muted-foreground">Клубын чат — Subscription шаардлагатай</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Дотоод чат зөвхөн төлбөртэй клубт нээлттэй</p>
                <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-primary/30 text-primary hover:bg-primary/10")}>
                  ✨ Subscription авах
                </Link>
              </CardContent>
            </Card>
          ) : !isMember || !currentUserId ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="font-medium text-muted-foreground">Чатад оролцохын тулд клубт нэгдэнэ үү</p>
              </CardContent>
            </Card>
          ) : (
            <ClubChat clubId={club.id} currentUserId={currentUserId} />
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {members.map((m, i) => {
                const p = m.profiles
                if (!p) return null
                const tier = getTier(p.rating_points)
                const canManage = myRole === "owner" && m.role !== "owner" && p.id !== currentUserId
                return (
                  <div key={i}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors border-b border-border/20 last:border-0">
                    <Link href={`/profile/${p.username}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {club.tag && <ClubNamePlate name={club.tag} color={club.tag_color} compact className="font-mono shrink-0" />}
                        <div className="text-sm font-medium truncate"><PlayerName p={p} /></div>
                      </div>
                      <p className="text-xs text-muted-foreground">@{p.username} · <span className={tier.color}>{tier.icon} {tier.tier}</span></p>
                    </Link>
                    {canManage && (
                      m.role === "admin"
                        ? <button onClick={() => changeMemberRole(p.id, "member")}
                            className="text-[10px] rounded border border-border/60 px-2 py-1 hover:bg-secondary transition-colors shrink-0">Цол хураах</button>
                        : <button onClick={() => changeMemberRole(p.id, "admin")}
                            className="text-[10px] rounded border border-primary/40 text-primary px-2 py-1 hover:bg-primary/10 transition-colors shrink-0">Орлогч болгох</button>
                    )}
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className={cn("text-[10px]", roleColor[m.role])}>
                        {m.role === "owner" && <Shield className="h-2.5 w-2.5 mr-1" />}
                        {roleLabel[m.role] ?? m.role}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatNumber(p.rating_points)}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
