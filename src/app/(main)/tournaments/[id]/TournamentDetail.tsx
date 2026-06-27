"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  ArrowLeft, Calendar, CheckCircle2, Copy, Eye, EyeOff,
  Globe, Lock, Loader2, MapPin, Settings, Share2, Target, Trophy, Users,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Edit, Edit2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import { Tournament, TournamentRegistration, Profile } from "@/types/database"
import { formatCurrency, formatDateTime } from "@/lib/utils/format"
import { OrganizerPanel } from "@/components/tournament/OrganizerPanel"
import { QRJoin } from "@/components/tournament/QRJoin"
import { TournamentBet } from "@/components/tournament/TournamentBet"
import { OrganizerRating } from "@/components/tournament/OrganizerRating"
import { useTournamentBracket } from "@/hooks/useTournamentBracket"
import { BracketView } from "@/components/tournament/BracketView"
import { OnlineBracketEditor } from "@/components/tournament/OnlineBracketEditor"
import { PlayerName } from "@/components/cosmetic/PlayerName"

type TournamentWithRelations = Tournament & {
  profiles: { id: string; display_name: string; username: string; avatar_url: string | null } | null
  clubs: { id: string; name: string; logo_url: string | null } | null
}

type RegistrationWithProfile = TournamentRegistration & {
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points" | "equipped_frame" | "name_effect" | "name_color" | "name_font" | "name_animated"> | null
}

const statusColors: Record<Tournament["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

const bracketLabels: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  groups_knockout: "Бүлэг + Шигшээ",
  swiss: "Swiss",
}

interface Props {
  tournament: TournamentWithRelations
  registrations: RegistrationWithProfile[]
  currentUserId: string | null
  isRegistered: boolean
  currentUserName?: string | null
}

export function TournamentDetail({ tournament: t, registrations, currentUserId, isRegistered, currentUserName = null }: Props) {
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(isRegistered)
  const [playerCount, setPlayerCount] = useState(t.current_players)
  const [showJoinPassword, setShowJoinPassword] = useState(false)
  const [joinPassword, setJoinPassword] = useState("")
  const [showCodeVisible, setShowCodeVisible] = useState(false)

  const isOrganizer = currentUserId === t.organizer_id
  const bracket = useTournamentBracket(t.id)
  const ongoingCount = bracket.ongoingCount

  async function handleRegister() {
    if (!currentUserId) { toast.error("Нэвтрэх шаардлагатай"); return }
    if (t.password && !registered) {
      if (joinPassword !== t.password) { toast.error("Нууц үг буруу байна"); return }
    }
    setLoading(true)
    const supabase = createClient()

    if (registered) {
      const { error } = await supabase
        .from("tournament_registrations")
        .delete()
        .eq("tournament_id", t.id)
        .eq("player_id", currentUserId)
      if (!error) { setRegistered(false); setPlayerCount((p) => p - 1); toast.success("Бүртгэлээс гарлаа") }
    } else {
      const { error } = await supabase
        .from("tournament_registrations")
        .insert({ tournament_id: t.id, player_id: currentUserId, payment_status: t.entry_fee > 0 ? "pending" : "paid" })
      if (!error) { setRegistered(true); setPlayerCount((p) => p + 1); toast.success("Амжилттай бүртгүүллээ!") }
      else toast.error("Бүртгэхэд алдаа гарлаа")
    }
    setLoading(false)
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    toast.success(mn.common.copied)
  }

  function copyJoinCode() {
    navigator.clipboard.writeText(t.join_code ?? "")
    toast.success("Join code хуулагдлаа")
  }

  const fillPct = (playerCount / t.max_players) * 100
  const canRegister = t.status === "registration" && playerCount < t.max_players

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Тэмцээнүүд
      </Link>

      {/* Header */}
      <Card className="border-border/50 bg-card/80 overflow-hidden">
        {t.banner_url && (
          <div className="h-40 overflow-hidden relative">
            <Image src={t.banner_url} alt={t.name} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover opacity-70" />
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${statusColors[t.status]}`}>
                  {mn.tournament.status[t.status]}
                </Badge>
                {t.status === "ongoing" && ongoingCount > 0 && (
                  <Badge className="text-xs bg-primary/15 text-primary border-primary/30 gap-1 pulse-live">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    LIVE · {ongoingCount} тоглолт
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                  {t.format}
                </Badge>
                <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">
                  {bracketLabels[t.bracket_type] ?? t.bracket_type}
                </Badge>
                {t.is_private ? (
                  <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground gap-1">
                    <Lock className="h-3 w-3" /> Private
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground gap-1">
                    <Globe className="h-3 w-3" /> Public
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold">{t.name}</h1>
              {t.description && <p className="text-muted-foreground text-sm leading-relaxed">{t.description}</p>}

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
              {isOrganizer && (
                <Link href={`/tournaments/${t.id}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-primary/30 text-primary hover:bg-primary/10")}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Засах
                </Link>
              )}
              {/* Зохион байгуулагч ч өөрөө оролцож болно. Үнэгүй → энгийн бүртгэл; бооцоотой бол доорх TournamentBet. */}
              {canRegister && (t.entry_fee === 0 || registered) && (
                <Button
                  size="sm"
                  onClick={handleRegister}
                  disabled={loading}
                  className={registered ? "border-border/60" : "glow-primary"}
                  variant={registered ? "outline" : "default"}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {registered ? (
                    <><CheckCircle2 className="mr-1.5 h-4 w-4 text-green-400" />Бүртгүүлсэн</>
                  ) : "Бүртгүүлэх"}
                </Button>
              )}
            </div>
          </div>

          {/* Password field — үнэгүй+private тэмцээнд (бооцоотой бол TournamentBet дотор) */}
          {canRegister && !registered && t.password && t.entry_fee === 0 && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
              <Label className="text-sm flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Нууц үг шаардлагатай</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showJoinPassword ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Тэмцээний нууц үг..."
                    className="bg-secondary/50 border-border/60 pr-9"
                  />
                  <button type="button" onClick={() => setShowJoinPassword(!showJoinPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showJoinPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button size="sm" onClick={handleRegister} disabled={loading} className="glow-primary shrink-0">
                  {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Нэгдэх
                </Button>
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Тоглогчид" value={`${playerCount}/${t.max_players}`} icon={Users} />
            <Stat label="Хураамж" value={t.entry_fee > 0 ? formatCurrency(t.entry_fee) : "Үнэгүй"} icon={Target} valueClass={t.entry_fee > 0 ? "text-[oklch(0.78_0.16_85)]" : "text-green-400"} />
            <Stat label="Шагналын сан" value={t.prize_pool > 0 ? formatCurrency(t.prize_pool) : "—"} icon={Trophy} valueClass="text-[oklch(0.78_0.16_85)]" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Дүүргэлт</p>
              <Progress value={fillPct} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground">{Math.round(fillPct)}%</p>
            </div>
          </div>

          {/* Бооцоотой тэмцээн — бүртгэл (банк авах) + зохион байгуулагчийн данс */}
          {t.entry_fee > 0 && currentUserId && (canRegister || registered) && (
            <TournamentBet
              tournamentId={t.id}
              entryFee={t.entry_fee}
              currentUserId={currentUserId}
              registered={registered}
              canRegister={canRegister}
              isOrganizer={isOrganizer}
              currentUserName={currentUserName}
              password={t.password}
              organizer={{
                bank_name: t.organizer_bank_name,
                iban: t.organizer_iban,
                account_number: t.organizer_account_number,
                account_holder: t.organizer_account_holder,
              }}
              onRegistered={() => { setRegistered(true); setPlayerCount((p) => p + 1) }}
            />
          )}

          {/* QR Join */}
          {(isOrganizer || registered) && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <QRJoin
                tournamentId={t.id}
                joinCode={t.join_code}
                isOrganizer={isOrganizer}
                isRegistered={registered}
              />
            </div>
          )}

          {t.join_code && (isOrganizer || registered) && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Join Code</p>
                  <p className="font-mono text-xl font-bold tracking-widest">
                    {showCodeVisible ? t.join_code : "••••••"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-border/60"
                    onClick={() => setShowCodeVisible(!showCodeVisible)}>
                    {showCodeVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" className="border-border/60" onClick={copyJoinCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
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
            Bracket
          </TabsTrigger>
          <TabsTrigger value="rules">Дүрэм</TabsTrigger>
          {t.status === "completed" && (
            <TabsTrigger value="rating">⭐ Үнэлгээ</TabsTrigger>
          )}
          {isOrganizer && (
            <TabsTrigger value="manage" className="text-primary data-[state=active]:bg-primary/15">
              ⚙ Удирдах
            </TabsTrigger>
          )}
          {isOrganizer && bracket.matches.length > 0 && (
            <TabsTrigger value="edit-bracket">
              <Edit2 className="h-4 w-4 mr-1.5" />
              Edit Bracket
            </TabsTrigger>
          )}
          {isOrganizer && (
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1.5" />
              Тохиргоо
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="players" className="mt-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0">
              {registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Одоогоор бүртгүүлсэн тоглогч байхгүй</p>
                </div>
              ) : (
                registrations.map((reg, i) => (
                  <Link key={reg.id} href={`/profile/${reg.profiles?.username}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0">
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
                      <div className="text-sm font-medium truncate">{reg.profiles ? <PlayerName p={reg.profiles} /> : "?"}</div>
                      <p className="text-xs text-muted-foreground">@{reg.profiles?.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[oklch(0.78_0.16_85)] score-display">
                        {reg.profiles?.rating_points}
                      </span>
                      <Badge className={`text-[10px] h-4 px-1 ${
                        reg.payment_status === "paid"
                          ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                      }`}>
                        {reg.payment_status === "paid" ? "Төлсөн" : "Хүлээгдэж байна"}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket" className="mt-4">
          <BracketView
            tournamentId={t.id}
            status={t.status}
            isOrganizer={isOrganizer}
            currentUserId={currentUserId}
            bracketType={t.bracket_type}
            matches={bracket.matches}
            entrants={bracket.entrants}
            playerEntrant={bracket.playerEntrant}
            loading={bracket.loading}
          />
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

        {t.status === "completed" && (
          <TabsContent value="rating" className="mt-4">
            <OrganizerRating
              tournamentId={t.id}
              organizerId={t.organizer_id}
              currentUserId={currentUserId}
              canRate={registered && !isOrganizer}
            />
          </TabsContent>
        )}

        {isOrganizer && (
          <TabsContent value="manage" className="mt-4">
            <OrganizerPanel tournament={t} registrations={registrations} />
          </TabsContent>
        )}

        {isOrganizer && bracket.matches.length > 0 && (
          <TabsContent value="edit-bracket" className="mt-4">
            <OnlineBracketEditor
              tournamentId={t.id}
              bracketType={t.bracket_type}
              groupsCount={t.groups_count}
              groupAdvance={t.group_advance}
              firstTo={t.first_to}
              setsEnabled={t.sets_enabled}
              entrants={bracket.entrants}
              matches={bracket.matches}
              onRefresh={bracket.refetch}
            />
          </TabsContent>
        )}

        {isOrganizer && (
          <TabsContent value="settings" className="mt-4">
            <Card className="border-primary/20 bg-card/80">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2 text-primary">
                    <Settings className="h-4 w-4" />
                    Тохиргоо
                  </h2>
                  <Link href={`/tournaments/${t.id}/edit`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-primary/30 text-primary hover:bg-primary/10")}>
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Засах
                  </Link>
                </div>

                {/* Тоглолтын формат */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Тоглолтын формат</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-border/60">{t.format}</Badge>
                    <Badge variant="outline" className="border-border/60">
                      {t.sets_enabled ? `BO${t.first_to} sets · ${t.legs_per_set}L` : `BO${t.first_to}`}
                    </Badge>
                    <Badge variant="outline" className="border-border/60">{bracketLabels[t.bracket_type] ?? t.bracket_type}</Badge>
                    <Badge variant="outline" className="border-border/60">{t.max_players} тоглогч</Badge>
                  </div>
                </div>

                {/* Дүрэм */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Дүрэм</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <SettingRow label="Захаар гарах" value={t.double_out} />
                    <SettingRow label="Double in" value={t.double_in} />
                    <SettingRow label="Loser First" value={t.loser_first} />
                    {t.limit_rounds && (
                      <SettingRow label={`Сумны хязгаар (${t.limit_rounds} багц)`} value={true} />
                    )}
                    {t.limit_rounds && t.bull_finish_at_limit && (
                      <SettingRow label="Сумны хязгаарт хүрэхэд Bull-off" value={true} />
                    )}
                  </div>
                </div>

                {/* Оноо тооцоо — RR/Swiss */}
                {(t.bracket_type === "round_robin" || t.bracket_type === "swiss" || t.bracket_type === "groups_knockout") && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Оноо тооцоо</p>
                    <div className="flex gap-6 text-sm">
                      <div className="text-center"><p className="text-muted-foreground text-xs">Хожил</p><p className="font-bold text-lg score-display">{t.point_won}</p></div>
                      <div className="text-center"><p className="text-muted-foreground text-xs">Тэнцэл</p><p className="font-bold text-lg score-display">{t.point_draw}</p></div>
                      <div className="text-center"><p className="text-muted-foreground text-xs">Хохирол</p><p className="font-bold text-lg score-display">{t.point_lost}</p></div>
                    </div>
                  </div>
                )}

                {/* Нэмэлт тохиргоо */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Нэмэлт тохиргоо</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <SettingRow label="Average харуулах" value={t.show_average} />
                    <SettingRow label="Автоматаар дуусгах" value={t.auto_complete} />
                    <SettingRow label="Өрсөлдөгчийг баталгаажуулах" value={t.confirm_opponent} />
                    <SettingRow label="Оролцогч оноо оруулах" value={t.allow_participant_score} />
                    <SettingRow label="Жагсаалтад дугаар" value={t.show_index} />
                    <SettingRow label="Private" value={t.is_private} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function Stat({ label, value, icon: Icon, valueClass = "" }: { label: string; value: string; icon: React.ElementType; valueClass?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />{label}
      </p>
      <p className={`text-base font-bold score-display ${valueClass}`}>{value}</p>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full shrink-0", value ? "bg-primary" : "bg-muted-foreground/30")} />
      <span className={value ? "text-foreground" : "text-muted-foreground/60 line-through"}>{label}</span>
    </div>
  )
}
