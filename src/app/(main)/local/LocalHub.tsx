"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { fetchPublicSessions, subscribeToPublicSessions } from "@/lib/local-game/sync"
import { Monitor, Plus, Radio, Target, Trash2, Trophy, Users, Wifi, Zap } from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { toast } from "sonner"
import type { LocalSession, LocalMatch, LocalLeg, LegThrow } from "@/lib/local-game/types"

const BRACKET_LABELS: Record<string, string> = {
  single_elimination: "Шуурхай хаалт",
  double_elimination: "Давхар хаалт",
  round_robin: "Бүгд бүгдтэй",
  groups_knockout: "Бүлэг + Хаалт",
  swiss: "Швейцар",
}

// Ongoing match-ийн товч мэдээлэл
function MatchPreview({ match, session }: { match: LocalMatch; session: LocalSession }) {
  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1 = playerMap[match.player1Id as string]
  const p2 = playerMap[match.player2Id as string]
  if (!p1 || !p2) return null

  const startScore = session.startScore || 501
  const currentLeg = match.legs.filter((l) => l.winnerId !== null).length
  const leg: Pick<LocalLeg, "throws"> = match.legs[currentLeg] ?? { throws: {} }

  function rem(pid: string) {
    const throws: LegThrow[] = leg.throws?.[pid] ?? []
    return startScore - throws.reduce((a, t) => a + (t.bust ? 0 : (t.score ?? 0)), 0)
  }

  return (
    <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <span className={cn("font-semibold truncate", match.player1Legs > match.player2Legs ? "text-primary" : "")}>
          {p1.name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-center">
        <span className="text-lg font-black score-display text-foreground/70">{rem(p1.id)}</span>
        <div className="text-center px-1">
          <p className="text-[10px] text-muted-foreground">Leg</p>
          <p className="text-xs font-bold score-display">{match.player1Legs}–{match.player2Legs}</p>
        </div>
        <span className="text-lg font-black score-display text-foreground/70">{rem(p2.id)}</span>
      </div>
      <div className="flex-1 min-w-0 text-right">
        <span className={cn("font-semibold truncate", match.player2Legs > match.player1Legs ? "text-primary" : "")}>
          {p2.name}
        </span>
      </div>
    </div>
  )
}

// Нийтийн session card
function PublicSessionCard({ session }: { session: LocalSession }) {
  const ongoingMatches = session.matches.filter((m) => m.status === "ongoing")
  const completedCount = session.matches.filter((m) => m.status === "completed").length
  const totalCount = session.matches.filter(
    (m) => m.player1Id && m.player2Id && m.player1Id !== "bye" && m.player2Id !== "bye"
  ).length

  // Ongoing match-аас эхний live URL олох
  const liveMatch = ongoingMatches[0]
  const liveUrl = liveMatch
    ? `/local/${session.id}/match/${liveMatch.id}/live`
    : `/local/${session.id}`

  return (
    <Card className="border-border/50 bg-card/80 hover:border-primary/30 transition-all overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{session.name}</h3>
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] pulse-live shrink-0">
                LIVE
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{session.players.length} тоглогч
              </span>
              <span>·</span>
              <span>{BRACKET_LABELS[session.bracketType] ?? session.bracketType}</span>
              <span>·</span>
              <span>{session.format.toUpperCase()} · BO{session.firstTo}</span>
              <span>·</span>
              <span>{completedCount}/{totalCount} тоглолт дууссан</span>
            </div>
          </div>
          <Link href={liveUrl}
            className={cn(buttonVariants({ size: "sm" }), "glow-primary shrink-0 text-xs")}>
            <Radio className="h-3.5 w-3.5 mr-1" />
            Үзэх
          </Link>
        </div>

        {/* Ongoing matches */}
        {ongoingMatches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />Одоо явагдаж байна
            </p>
            {ongoingMatches.slice(0, 3).map((m) => (
              <Link key={m.id} href={`/local/${session.id}/match/${m.id}/live`}>
                <MatchPreview match={m} session={session} />
              </Link>
            ))}
            {ongoingMatches.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">+{ongoingMatches.length - 3} тоглолт</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function LocalHub() {
  const getSummaries = useLocalGame((s) => s.getSummaries)
  const deleteSession = useLocalGame((s) => s.deleteSession)
  // sessions-д subscribe хийснээр delete/add/update үед автоматаар re-render болно.
  // ⚠️ Object.keys(s.sessions) нь render бүрт ШИНЭ массив буцааж zustand snapshot-ийг
  // байнга өөрчилснөөс хязгааргүй re-render (React #185) үүсгэдэг байв. s.sessions нь
  // тогтвортой reference (store immutable шинэчилдэг тул mutation үед л солигдоно).
  useLocalGame((s) => s.sessions)
  const [mounted, setMounted] = useState(false)
  const [publicSessions, setPublicSessions] = useState<LocalSession[]>([])
  const [loadingPublic, setLoadingPublic] = useState(false)

  useEffect(() => setMounted(true), [])

  const summaries = mounted ? getSummaries() : []

  // Нийтийн тоглолтууд татах + realtime subscribe
  useEffect(() => {
    if (!mounted) return
    setLoadingPublic(true)
    fetchPublicSessions().then((sessions) => {
      setPublicSessions(sessions)
      setLoadingPublic(false)
    })
    const unsub = subscribeToPublicSessions(setPublicSessions)
    return unsub
  }, [mounted])

  function handleDelete(id: string, name: string) {
    if (confirm(`"${name}" тоглолтыг устгах уу?`)) {
      deleteSession(id)
      toast.success("Тоглолт устгагдлаа")
    }
  }

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Local тоглолт
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Офлайн тэмцээн, лиг, тоглолт</p>
        </div>
        <div className="flex gap-2">
          <Link href="/local/ffa/new" className={cn(buttonVariants({ variant: "outline" }), "shrink-0 border-primary/30 text-primary hover:bg-primary/10")}>
            <Users className="h-4 w-4 mr-1.5" />Зэрэгцэн
          </Link>
          <Link href="/local/new" className={cn(buttonVariants(), "glow-primary shrink-0")}>
            <Plus className="h-4 w-4 mr-1.5" />Тэмцээн
          </Link>
        </div>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="bg-secondary/50 w-full">
          <TabsTrigger value="mine" className="flex-1">
            Миний тоглолтууд
            {summaries.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-[10px] rounded-full px-1.5">{summaries.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="public" className="flex-1">
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
            Нээлттэй тоглолтууд
            {publicSessions.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-[10px] rounded-full px-1.5 pulse-live">
                {publicSessions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Миний тоглолтууд ── */}
        <TabsContent value="mine" className="mt-4">
          {summaries.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Target className="h-14 w-14 text-muted-foreground/20" />
                <div>
                  <p className="font-semibold text-muted-foreground">Тоглолт байхгүй</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Найзуудтайгаа тэмцээн зохиогоод тоглож эхэл</p>
                </div>
                <Link href="/local/new" className={cn(buttonVariants(), "mt-2 glow-primary")}>
                  <Plus className="h-4 w-4 mr-1.5" />Эхний тоглолт үүсгэх
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {summaries.map((s) => (
                <Card key={s.id} className={cn("border-border/50 bg-card/80 card-hover overflow-hidden", s.status === "completed" ? "opacity-70" : "")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/local/${s.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{s.name}</h3>
                          {s.status === "completed" ? (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs shrink-0">Дууссан</Badge>
                          ) : s.phase === "accepting_entries" ? (
                            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs shrink-0">Бүртгэл</Badge>
                          ) : s.phase === "making_bracket" ? (
                            <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs shrink-0">Хаалт зохиож байна</Badge>
                          ) : (
                            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs shrink-0 pulse-live">Явагдаж байна</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{s.format.toUpperCase()}</span>
                          <span>·</span>
                          <span>{BRACKET_LABELS[s.bracketType] ?? s.bracketType}</span>
                          <span>·</span>
                          <span>{s.playerCount} тоглогч</span>
                          <span>·</span>
                          <span>{formatDate(s.createdAt)}</span>
                        </div>
                        {s.status === "completed" && s.winnerName && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm">
                            <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
                            <span className="font-semibold text-[oklch(0.78_0.16_85)]">{s.winnerName}</span>
                            <span className="text-muted-foreground">— Ялагч</span>
                          </div>
                        )}
                      </Link>
                      <button onClick={() => handleDelete(s.id, s.name)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Нээлттэй тоглолтууд ── */}
        <TabsContent value="public" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5 text-primary shrink-0" />
            Нууц үггүй, одоо явагдаж байгаа тоглолтууд. Realtime шинэчлэгдэнэ.
          </div>

          {loadingPublic ? (
            <div className="space-y-3">
              {[1,2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : publicSessions.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Radio className="h-14 w-14 text-muted-foreground/20" />
                <div>
                  <p className="font-semibold text-muted-foreground">Нээлттэй тоглолт байхгүй</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Нууц үггүй тоглолт эхлүүлэх үед энд харагдана
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            publicSessions.map((s) => <PublicSessionCard key={s.id} session={s} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
