"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Building2, Check, Edit, Globe, LogIn, LogOut,
  MapPin, MessageCircle, QrCode, Settings, Share2, Shield, Swords, Users,
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
type MemberRow = {
  role: string
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points" | "equipped_frame" | "name_effect" | "name_color" | "name_font" | "name_animated"> | null
}

interface Props {
  club: ClubWithExtra
  members: MemberRow[]
  currentUserId: string | null
  myRole: string | null
}

const roleLabel: Record<string, string> = { owner: "Удирдагч", admin: "Орлогч", member: "Гишүүн" }
const roleColor: Record<string, string> = {
  owner: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  admin: "bg-primary/15 text-primary border-primary/30",
  member: "bg-secondary text-muted-foreground",
}

export function ClubDetail({ club, members, currentUserId, myRole }: Props) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin"
  const isMember = !!myRole
  const hasSub = !!club.subscription_plan
  const features = Array.isArray(club.features) ? club.features as string[] : []

  async function handleJoin() {
    if (!currentUserId) { router.push("/login"); return }
    setJoining(true)
    const supabase = createClient()
    const { error } = await supabase.from("club_members").insert({
      club_id: club.id, player_id: currentUserId, role: "member",
    })
    if (error) toast.error("Нэгдэхэд алдаа гарлаа")
    else { toast.success(`${club.name}-д нэгдлээ!`); router.refresh() }
    setJoining(false)
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
          <div className="h-36 overflow-hidden">
            <img src={club.cover_url} alt={club.name} className="w-full h-full object-cover opacity-70" />
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
                  <ClubNamePlate name={club.tag} color={club.tag_color} score={club.club_score} orbit={!!club.subscription_plan} className="font-mono shrink-0" />
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
              <Button onClick={handleJoin} disabled={joining} className="glow-primary">
                <LogIn className="h-4 w-4 mr-1.5" />
                Клубт нэгдэх
              </Button>
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

      {/* Members + Chat */}
      <Tabs defaultValue="members">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" />Гишүүд ({members.length})</TabsTrigger>
          <TabsTrigger value="chat"><MessageCircle className="h-4 w-4 mr-1.5" />Чат</TabsTrigger>
          <TabsTrigger value="war"><Swords className="h-4 w-4 mr-1.5" />Дайн</TabsTrigger>
        </TabsList>

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
                        {club.tag && <ClubNamePlate name={club.tag} color={club.tag_color} score={club.club_score} compact className="font-mono shrink-0" />}
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
                      <p className="text-xs text-muted-foreground mt-0.5">{formatNumber(p.rating_points)} pts</p>
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
