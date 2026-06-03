"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trophy, Zap } from "lucide-react"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout } from "@/lib/local-game/checkouts"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function LiveView() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const [mounted, setMounted] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    // Poll every 800ms to catch Zustand state changes
    const timer = setInterval(() => setTick(t => t + 1), 800)
    return () => clearInterval(timer)
  }, [])

  // Zustand subscription — real-time updates
  const session = useLocalGame((s) => s.sessions[sessionId])

  if (!mounted) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (!session) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 gap-4">
      <p className="text-white/50">Тоглолт олдсонгүй</p>
      <Link href="/local" className={cn(buttonVariants({ variant: "outline" }))}>Буцах</Link>
    </div>
  )

  const match = session.matches.find((m) => m.id === matchId)
  if (!match) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <p className="text-white/50">Match олдсонгүй</p>
    </div>
  )

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1Id = match.player1Id as string
  const p2Id = match.player2Id as string
  const p1 = playerMap[p1Id]
  const p2 = playerMap[p2Id]
  const startScore = session.startScore || 501
  const legsToWin = session.firstTo || 1

  const currentLegIdx = match!.legs.filter((l) => l.winnerId !== null).length
  const currentLeg = match!.legs[currentLegIdx]

  function getRemaining(playerId: string): number {
    if (session.format === "cricket" || session.format === "cutthroat") return 0
    const throws = (currentLeg as any)?.throws?.[playerId] ?? []
    const thrown = throws.reduce((a: number, t: any) => a + (t.score ?? 0), 0)
    return Math.max(0, startScore - thrown)
  }

  function getAverage(playerId: string): string {
    const allScores: number[] = match!.legs.flatMap((leg) =>
      ((leg as any)?.throws?.[playerId] ?? []).map((t: any) => t.score ?? 0)
    )
    if (allScores.length === 0) return "—"
    const sum = allScores.reduce((a, s) => a + s, 0)
    return (sum / allScores.length * 3).toFixed(1)
  }

  function getTotalDarts(playerId: string): number {
    return match!.legs.flatMap((leg) => (leg as any)?.throws?.[playerId] ?? []).length * 3
  }

  function getLastThrows(playerId: string): number[] {
    return ((currentLeg as any)?.throws?.[playerId] ?? []).slice(-3).map((t: any) => t.score ?? 0)
  }

  // Infer active player: whoever has fewer throws in current leg goes next
  const p1Throws = ((currentLeg as any)?.throws?.[p1Id] ?? []).length
  const p2Throws = ((currentLeg as any)?.throws?.[p2Id] ?? []).length
  const activeId = p1Throws <= p2Throws ? p1Id : p2Id

  const rem1 = getRemaining(p1Id)
  const rem2 = getRemaining(p2Id)
  const co1 = getCheckout(rem1)
  const co2 = getCheckout(rem2)

  const isOngoing = match.status === "ongoing"
  const isCompleted = match.status === "completed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <Link href={`/local/${sessionId}`}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Буцах
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
          {isCompleted && <span className="text-[11px] font-bold text-green-400">ДУУССАН</span>}
          {match.status === "pending" && <span className="text-[11px] text-white/30">Эхлээгүй</span>}
        </div>
      </div>

      {/* Winner banner */}
      {isCompleted && match.winnerId && (
        <div className="bg-[oklch(0.78_0.16_85)]/20 border-b border-[oklch(0.78_0.16_85)]/30 px-4 py-3 flex items-center justify-center gap-3">
          <Trophy className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
          <p className="font-black text-[oklch(0.78_0.16_85)] text-xl">
            {playerMap[match.winnerId]?.name} — Ялагч!
          </p>
          <Trophy className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
        </div>
      )}

      {/* Leg score */}
      <div className="flex items-center justify-center gap-10 py-5 border-b border-white/10 shrink-0">
        <span className="text-5xl font-black score-display">{match.player1Legs}</span>
        <div className="text-center">
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Leg</p>
          <p className="text-sm font-bold">{currentLegIdx + 1} / {legsToWin}</p>
        </div>
        <span className="text-5xl font-black score-display">{match.player2Legs}</span>
      </div>

      {/* Player score panels */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-white/10">
        {[
          { id: p1Id, player: p1, rem: rem1, legs: match.player1Legs, co: co1, last: getLastThrows(p1Id) },
          { id: p2Id, player: p2, rem: rem2, legs: match.player2Legs, co: co2, last: getLastThrows(p2Id) },
        ].map(({ id, player, rem, legs, co, last }) => {
          const isActive = id === activeId && isOngoing
          const isWinner = isCompleted && match.winnerId === id

          return (
            <div key={id} className={cn(
              "flex flex-col items-center justify-center py-6 px-4 relative transition-all duration-300",
              isActive ? "bg-primary/5" : ""
            )}>
              {/* "Шидэх ээлж" indicator */}
              {isActive && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 bg-primary/20 rounded-full px-3 py-1 border border-primary/30">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary">Шидэх ээлж</span>
                </div>
              )}
              {isWinner && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                  <Trophy className="h-5 w-5 text-[oklch(0.78_0.16_85)]" />
                </div>
              )}

              {/* Name */}
              <p className={cn("text-lg font-bold truncate max-w-full mt-10 mb-1",
                isActive ? "text-white" : "text-white/60")}>{player?.name ?? "?"}</p>

              {/* Leg dots */}
              <div className="flex gap-2 mb-3">
                {Array.from({ length: legsToWin }).map((_, i) => (
                  <div key={i} className={cn("h-3 w-3 rounded-full transition-all duration-300",
                    i < legs ? "bg-primary" : "bg-white/15")} />
                ))}
              </div>

              {/* Remaining — very large */}
              <div className={cn(
                "text-[88px] leading-none font-black score-display transition-all duration-300",
                isActive ? "text-white" : isWinner ? "text-[oklch(0.78_0.16_85)]" : "text-white/50"
              )}>
                {rem}
              </div>

              {/* Checkout hint */}
              {co && isActive && (
                <div className="mt-3 bg-[oklch(0.78_0.16_85)]/20 border border-[oklch(0.78_0.16_85)]/30 rounded-xl px-4 py-2">
                  <p className="font-mono text-base font-bold text-[oklch(0.78_0.16_85)]">{co}</p>
                </div>
              )}

              {/* Last 3 throws */}
              {last.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {last.map((s, i) => (
                    <div key={i} className={cn(
                      "rounded-lg px-3 py-1.5 border text-center",
                      isActive ? "bg-primary/15 border-primary/20" : "bg-white/5 border-white/10"
                    )}>
                      <p className={cn("text-lg font-bold score-display",
                        isActive ? "text-primary" : "text-white/50")}>{s}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="border-t border-white/10 px-4 py-3 shrink-0 bg-black/20">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold score-display">{getAverage(p1Id)}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Average</p>
          </div>
          <div className="border-x border-white/10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Нийт дарт</p>
              <div className="flex items-center gap-2 justify-center mt-0.5">
                <span className="text-sm font-bold">{getTotalDarts(p1Id)}</span>
                <span className="text-white/20 text-xs">vs</span>
                <span className="text-sm font-bold">{getTotalDarts(p2Id)}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xl font-bold score-display">{getAverage(p2Id)}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Average</p>
          </div>
        </div>

        {/* Leg history */}
        {match!.legs.filter(l => l.winnerId).length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-center mt-2.5">
            {match!.legs.filter(l => l.winnerId).map((leg, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1 text-xs">
                <span className={cn(leg.winnerId === p1Id ? "text-primary font-bold" : "text-white/30")}>{p1?.name}</span>
                <span className="text-white/20">L{i+1}</span>
                <span className={cn(leg.winnerId === p2Id ? "text-primary font-bold" : "text-white/30")}>{p2?.name}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-white/15 mt-2">
          {isOngoing ? "↻ Автоматаар шинэчлэгдэнэ" : "Тоглолт дууссан"}
        </p>
      </div>
    </div>
  )
}
