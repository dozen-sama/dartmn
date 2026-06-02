"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Share2,
  Target,
  Trophy,
  Users,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import { Tournament, TournamentRegistration, Profile } from "@/types/database"
import { formatCurrency, formatDateTime } from "@/lib/utils/format"

type TournamentWithRelations = Tournament & {
  profiles: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  clubs: { id: string; name: string; logo_url: string | null } | null
}

type RegistrationWithProfile = TournamentRegistration & {
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points"> | null
}

const statusColors: Record<Tournament["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

interface Props {
  tournament: TournamentWithRelations
  registrations: RegistrationWithProfile[]
  currentUserId: string | null
  isRegistered: boolean
}

export function TournamentDetail({ tournament: t, registrations, currentUserId, isRegistered }: Props) {
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(isRegistered)
  const [playerCount, setPlayerCount] = useState(t.current_players)

  async function handleRegister() {
    if (!currentUserId) {
      toast.error("Нэвтрэх шаардлагатай")
      return
    }
    setLoading(true)
    const supabase = createClient()

    if (registered) {
      const { error } = await supabase
        .from("tournament_registrations")
        .delete()
        .eq("tournament_id", t.id)
        .eq("player_id", currentUserId)

      if (!error) {
        setRegistered(false)
        setPlayerCount((p) => p - 1)
        toast.success("Бүртгэлээс гарлаа")
      }
    } else {
      const { error } = await supabase
        .from("tournament_registrations")
        .insert({
          tournament_id: t.id,
          player_id: currentUserId,
          payment_status: t.entry_fee > 0 ? "pending" : "paid",
        })

      if (!error) {
        setRegistered(true)
        setPlayerCount((p) => p + 1)
        toast.success("Амжилттай бүртгүүллээ!")
      } else {
        toast.error("Бүртгэхэд алдаа гарлаа")
      }
    }
    setLoading(false)
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    toast.success(mn.common.copied)
  }

  const fillPct = (playerCount / t.max_players) * 100
  const canRegister = t.status === "registration" && playerCount < t.max_players

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Тэмцээнүүд
      </Link>

      {/* Header card */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        {t.banner_url && (
          <div className="h-40 overflow-hidden">
            <img src={t.banner_url} alt={t.name} className="w-full h-full object-cover opacity-70" />
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${statusColors[t.status]}`}>
                  {mn.tournament.status[t.status]}
                </Badge>
                <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                  {t.format}
                </Badge>
                <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                  {mn.tournament.types[t.type]}
                </Badge>
              </div>

              <h1 className="text-2xl font-bold">{t.name}</h1>

              {t.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{t.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(t.start_date)}
                </span>
                {t.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {t.location}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleShare} className="border-border/60">
                <Share2 className="h-4 w-4" />
              </Button>
              {canRegister && (
                <Button
                  size="sm"
                  onClick={handleRegister}
                  disabled={loading}
                  className={registered ? "border-border/60" : "glow-primary"}
                  variant={registered ? "outline" : "default"}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {registered ? (
                    <>
                      <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-400" />
                      Бүртгүүлсэн
                    </>
                  ) : (
                    mn.tournament.register
                  )}
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Тоглогчид" value={`${playerCount}/${t.max_players}`} icon={Users} />
            <Stat
              label="Хураамж"
              value={t.entry_fee > 0 ? formatCurrency(t.entry_fee) : "Үнэгүй"}
              icon={Target}
              valueClass={t.entry_fee > 0 ? "text-gold" : "text-green-400"}
            />
            <Stat
              label="Шагналын сан"
              value={t.prize_pool > 0 ? formatCurrency(t.prize_pool) : "—"}
              icon={Trophy}
              valueClass="text-gold"
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Дүүргэлт</p>
              <Progress value={fillPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground">{Math.round(fillPct)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="players">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="players">
            <Users className="h-4 w-4 mr-1.5" />
            Тоглогчид ({registrations.length})
          </TabsTrigger>
          <TabsTrigger value="bracket">
            <Trophy className="h-4 w-4 mr-1.5" />
            Хаалт
          </TabsTrigger>
          <TabsTrigger value="rules">Дүрэм</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Одоогоор бүртгүүлсэн тоглогч байхгүй байна</p>
                </div>
              ) : (
                registrations.map((reg, i) => (
                  <Link
                    key={reg.id}
                    href={`/profile/${reg.profiles?.username}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <span className="text-sm font-bold w-6 text-center score-display text-muted-foreground">
                      {reg.seed ?? i + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reg.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-secondary">
                        {reg.profiles?.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reg.profiles?.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{reg.profiles?.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gold score-display">
                        {reg.profiles?.rating_points} pts
                      </span>
                      {reg.payment_status === "paid" ? (
                        <Badge className="text-[10px] h-4 px-1 bg-green-500/15 text-green-400 border-green-500/30">
                          Төлсөн
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] h-4 px-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                          Хүлээгдэж байна
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Trophy className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">
                {t.status === "registration"
                  ? "Тэмцээн эхэлсний дараа хаалт гарна"
                  : "Хаалт бэлэн болоогүй байна"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5">
              {t.rules ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{t.rules}</p>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">Дүрэм оруулаагүй байна</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, icon: Icon, valueClass = "" }: {
  label: string
  value: string
  icon: React.ElementType
  valueClass?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className={`text-base font-bold score-display ${valueClass}`}>{value}</p>
    </div>
  )
}
