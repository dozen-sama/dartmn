"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BarChart3, Target, Trophy, Zap } from "lucide-react"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout } from "@/lib/local-game/checkouts"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
// Unused imports removed for cleanliness

function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center bg-white/5 rounded-xl px-4 py-2">
      <span className={cn("text-xl font-black score-display", accent ? "text-primary" : "")}>{value}</span>
      <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
    </div>
  )
}

export function LiveView() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const session = useLocalGame((s) => s.sessions[sessionId])

  if (!mounted) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (!session) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-muted-foreground">Тоглолт олдсонгүй</p>
      <Link href="/local" className={cn(buttonVariants({ variant: "outline" }))}>Буцах</Link>
    </div>
  )

  const match = session.matches.find((m) => m.id === matchId)
  if (!match) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Match олдсонгүй</p>
    </div>
  )

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1 = playerMap[match.player1Id as string]
  const p2 = playerMap[match.player2Id as string]

  const currentLegIndex = match!.legs.filter((l) => l.winnerId !== null).length
  const currentLeg = match.legs[currentLegIndex]

  function getRemaining(playerId: string): number {
    if (session.format === "cricket") return 0
    const throws = (currentLeg as any)?.throws?.[playerId] ?? []
    return session.startScore - throws.reduce((a: number, t: any) => a + t.score, 0)
  }

  function getVisitAvg(playerId: string): string {
    const allThrows: number[] = match!.legs.flatMap((leg) => ((leg as any).throws?.[playerId] ?? []).map((t: any) => t.score))
    if (allThrows.length === 0) return "—"
    const totalScore = session.startScore * match!.legs.filter((l) => l.winnerId !== null).length -
      Math.max(0, getRemaining(playerId))
    const darts = allThrows.length
    return darts > 0 ? (totalScore / darts * 3).toFixed(1) : "—"
  }

  function getDartsThrown(playerId: string): number {
    return match!.legs.flatMap((leg) => (leg as any).throws?.[playerId] ?? []).length * 3
  }

  const rem1 = getRemaining(match.player1Id as string)
  const rem2 = getRemaining(match.player2Id as string)
  const co1 = getCheckout(rem1)
  const co2 = getCheckout(rem2)

  // Last throws in current leg
  const lastThrows1 = ((currentLeg as any)?.throws?.[match.player1Id as string] ?? []).slice(-3)
  const lastThrows2 = ((currentLeg as any)?.throws?.[match.player2Id as string] ?? []).slice(-3)

  const isOngoing = match.status === "ongoing"
  const isCompleted = match.status === "completed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <Link href={`/local/${sessionId}`}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Хуваарь
        </Link>
        <div className="text-center">
          <p className="text-xs font-semibold">{session.name}</p>
          <p className="text-[10px] text-white/40">{session.format.toUpperCase()} · BO{session.firstTo}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOngoing && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              LIVE
            </span>
          )}
          {isCompleted && (
            <span className="text-[11px] font-bold text-green-400">ДУУССАН</span>
          )}
        </div>
      </div>

      {/* Winner banner */}
      {isCompleted && match.winnerId && (
        <div className="bg-[oklch(0.78_0.16_85)]/20 border-b border-[oklch(0.78_0.16_85)]/30 px-4 py-3 flex items-center justify-center gap-3">
          <Trophy className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
          <p className="font-black text-[oklch(0.78_0.16_85)] text-lg">
            {playerMap[match.winnerId]?.name} — Ялагч!
          </p>
          <Trophy className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
        </div>
      )}

      {/* Leg score header */}
      <div className="flex items-center justify-center gap-6 py-4 border-b border-white/10">
        <span className="text-4xl font-black score-display">{match.player1Legs}</span>
        <div className="text-center">
          <p className="text-xs text-white/40 uppercase tracking-widest">Leg</p>
          <p className="text-sm font-bold">{currentLegIndex + 1} / {session.firstTo}</p>
        </div>
        <span className="text-4xl font-black score-display">{match.player2Legs}</span>
      </div>

      {/* Player scores — LARGE */}
      <div className="grid grid-cols-2 gap-0 border-b border-white/10">
        {[
          { id: match.player1Id as string, player: p1, rem: rem1, legs: match.player1Legs, co: co1, lastThrows: lastThrows1 },
          { id: match.player2Id as string, player: p2, rem: rem2, legs: match.player2Legs, co: co2, lastThrows: lastThrows2 },
        ].map(({ id, player, rem, legs, co, lastThrows }, side) => {
          const isWinner = match.winnerId === id

          return (
            <div key={id} className={cn(
              "flex flex-col items-center py-8 px-4 relative",
              side === 0 ? "border-r border-white/10" : ""
            )}>
              {isWinner && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2">
                  <Trophy className="h-5 w-5 text-[oklch(0.78_0.16_85)]" />
                </div>
              )}

              {/* Player name */}
              <p className="text-base font-bold truncate max-w-full">{player?.name ?? "?"}</p>

              {/* Leg dots */}
              <div className="flex gap-1.5 my-2">
                {Array.from({ length: session.firstTo }).map((_, i) => (
                  <div key={i} className={cn("h-2.5 w-2.5 rounded-full",
                    i < legs ? "bg-primary" : "bg-white/15")} />
                ))}
              </div>

              {/* REMAINING — very large */}
              <div className={cn("text-7xl font-black score-display my-2",
                isCompleted && isWinner ? "text-[oklch(0.78_0.16_85)]" : "text-white")}>
                {rem}
              </div>

              {/* Checkout hint */}
              {co && isOngoing && (
                <div className="bg-[oklch(0.78_0.16_85)]/20 border border-[oklch(0.78_0.16_85)]/30 rounded-lg px-3 py-1.5 mt-1">
                  <p className="font-mono text-sm font-bold text-[oklch(0.78_0.16_85)]">{co}</p>
                </div>
              )}

              {/* Last throws */}
              {lastThrows.length > 0 && isOngoing && (
                <div className="flex gap-2 mt-3">
                  {lastThrows.map((t: any, i: number) => (
                    <div key={i} className="bg-white/10 rounded-lg px-2.5 py-1 text-center">
                      <p className="text-sm font-bold score-display">{t.score}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Statistics */}
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-white/40" />
          <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Статистик</p>
        </div>

        {/* Side by side stats */}
        <div className="grid grid-cols-3 gap-2">
          {/* P1 stats */}
          <div className="space-y-2">
            {[
              { label: "Average", value: getVisitAvg(match.player1Id as string) },
              { label: "Дарт", value: getDartsThrown(match.player1Id as string) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-2 text-right">
                <p className="text-base font-bold score-display">{value}</p>
                <p className="text-[10px] text-white/40">{label}</p>
              </div>
            ))}
          </div>

          {/* Labels */}
          <div className="space-y-2 flex flex-col">
            {["Average", "Дарт"].map((label) => (
              <div key={label} className="flex-1 flex items-center justify-center">
                <p className="text-[11px] text-white/30 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* P2 stats */}
          <div className="space-y-2">
            {[
              { label: "Average", value: getVisitAvg(match.player2Id as string) },
              { label: "Дарт", value: getDartsThrown(match.player2Id as string) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-2 text-left">
                <p className="text-base font-bold score-display">{value}</p>
                <p className="text-[10px] text-white/40">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leg history */}
        {match!.legs.filter((l) => l.winnerId !== null).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Leg түүх</p>
            <div className="space-y-1.5">
              {match!.legs.filter((l) => l.winnerId !== null).map((leg, i) => {
                const isP1Win = leg.winnerId === match.player1Id
                return (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <div className={cn("flex items-center gap-1.5",
                      isP1Win ? "text-primary font-semibold" : "text-white/40")}>
                      <span className="text-xs">{p1?.name}</span>
                      {isP1Win && <Trophy className="h-3 w-3" />}
                    </div>
                    <span className="text-[10px] text-white/30">Leg {i + 1}</span>
                    <div className={cn("flex items-center gap-1.5",
                      !isP1Win ? "text-primary font-semibold" : "text-white/40")}>
                      {!isP1Win && <Trophy className="h-3 w-3" />}
                      <span className="text-xs">{p2?.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live refresh note */}
      {isOngoing && (
        <p className="text-center text-[10px] text-white/20 pb-6">
          ↻ Автоматаар шинэчлэгдэнэ (хуудсыг refresh хийх шаардлагагүй)
        </p>
      )}
    </div>
  )
}
