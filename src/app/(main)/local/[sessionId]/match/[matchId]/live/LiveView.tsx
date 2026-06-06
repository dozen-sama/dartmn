"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trophy } from "lucide-react"
import { useLocalGame } from "@/lib/local-game/store"
import { getCheckout } from "@/lib/local-game/checkouts"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function LiveView() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const [mounted, setMounted] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const t = setInterval(() => {}, 800)
    return () => clearInterval(t)
  }, [])

  const session = useLocalGame((s) => s.sessions[sessionId])

  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = tableRef.current.scrollHeight
  })

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
  if (!match) return <div className="flex items-center justify-center min-h-screen bg-slate-950"><p className="text-white/50">Match олдсонгүй</p></div>

  const playerMap = Object.fromEntries(session.players.map((p) => [p.id, p]))
  const p1Id = match.player1Id as string
  const p2Id = match.player2Id as string
  const p1 = playerMap[p1Id]
  const p2 = playerMap[p2Id]
  const startScore  = session.startScore || 501
  const legsToWin   = session.firstTo || 1
  const limitRounds = session.limitRounds ?? null

  const completedLegs = match.legs.filter((l) => l.winnerId !== null).length
  const currentLeg    = match.legs[completedLegs] ?? { throws: {}, winnerId: null }

  const p1Throws: any[] = (currentLeg as any).throws?.[p1Id] ?? []
  const p2Throws: any[] = (currentLeg as any).throws?.[p2Id] ?? []
  const maxVisits = Math.max(p1Throws.length, p2Throws.length)

  function getRemaining(throws: any[]): number {
    return startScore - throws.reduce((a: number, t: any) => a + (t.score ?? 0), 0)
  }

  function getAverage(playerId: string): string {
    const all: number[] = match!.legs.flatMap((leg) =>
      ((leg as any)?.throws?.[playerId] ?? []).map((t: any) => t.score ?? 0)
    )
    if (!all.length) return "—"
    return (all.reduce((a, s) => a + s, 0) / all.length * 3).toFixed(1)
  }

  function getCurrentAvg(throws: any[]): string {
    if (!throws.length) return "—"
    const sum = throws.reduce((a: number, t: any) => a + (t.score ?? 0), 0)
    return (sum / throws.length * 3).toFixed(1)
  }

  // Who threw last (infer active player)
  const p1Ct = p1Throws.length
  const p2Ct = p2Throws.length
  const activeId = p1Ct <= p2Ct ? p1Id : p2Id

  const rem1 = getRemaining(p1Throws)
  const rem2 = getRemaining(p2Throws)
  const co1  = getCheckout(rem1)
  const co2  = getCheckout(rem2)

  const totalDarts = (p1Ct + p2Ct) * 3
  const visitRound = Math.max(p1Ct, p2Ct)

  // P1 leg wins across all legs
  const p1LegWins = match.legs.filter(l => l.winnerId === p1Id).length
  const p2LegWins = match.legs.filter(l => l.winnerId === p2Id).length

  // Last 3 throws per player in current leg
  const last1 = p1Throws.slice(-3).map((t: any) => t.score ?? 0)
  const last2 = p2Throws.slice(-3).map((t: any) => t.score ?? 0)

  const isOngoing   = match.status === "ongoing"
  const isCompleted = match.status === "completed"

  // Visit rows for table (per-visit alternating)
  type VRow = { dartNo: number; p1s?: number; p1r?: number; p2s?: number; p2r?: number }
  const visitRows: VRow[] = []
  for (let i = 0; i < maxVisits; i++) {
    const t1 = p1Throws[i]
    const t2 = p2Throws[i]
    const r1 = t1 ? startScore - p1Throws.slice(0, i + 1).reduce((a: number, t: any) => a + t.score, 0) : undefined
    const r2 = t2 ? startScore - p2Throws.slice(0, i + 1).reduce((a: number, t: any) => a + t.score, 0) : undefined
    if (t1) visitRows.push({ dartNo: (i * 2 + 1) * 3, p1s: t1.score, p1r: r1 })
    if (t2) visitRows.push({ dartNo: (i + 1) * 6, p2s: t2.score, p2r: r2 })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <Link href={`/local/${sessionId}`} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />Буцах
        </Link>
        <div className="text-center">
          <p className="text-xs font-bold text-white/80">{session.name}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-widest">{session.format} · BO{session.firstTo}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOngoing && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />LIVE
            </span>
          )}
          {isCompleted && <span className="text-[11px] font-bold text-green-400">ДУУССАН</span>}
        </div>
      </div>

      {/* ── Winner banner ── */}
      {isCompleted && match.winnerId && (
        <div className="bg-yellow-400/15 border-b border-yellow-400/20 px-4 py-3 flex items-center justify-center gap-3 shrink-0">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <p className="font-black text-yellow-400 text-lg">{playerMap[match.winnerId]?.name} — Ялагч!</p>
          <Trophy className="h-5 w-5 text-yellow-400" />
        </div>
      )}

      {/* ── Leg score & set bars ── */}
      <div className="flex items-center justify-center gap-8 px-4 py-3 border-b border-white/10 shrink-0 bg-white/5">
        {/* P1 leg bar */}
        <div className="flex flex-col items-end gap-1">
          <p className="text-[11px] text-white/40 truncate max-w-[80px] text-right">{p1?.name}</p>
          <div className="flex gap-1">
            {Array.from({ length: legsToWin }).map((_, i) => (
              <div key={i} className={cn("h-2 rounded-full transition-all", i < match.player1Legs ? "bg-primary w-5" : "bg-white/15 w-3")} />
            ))}
          </div>
        </div>

        {/* Leg score */}
        <div className="flex items-center gap-4">
          <span className={cn("text-5xl font-black score-display", activeId === p1Id ? "text-white" : "text-white/40")}>
            {match.player1Legs}
          </span>
          <div className="text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-widest">Leg</p>
            <p className="text-xs font-bold text-white/50">{completedLegs + 1}/{legsToWin}</p>
          </div>
          <span className={cn("text-5xl font-black score-display", activeId === p2Id ? "text-white" : "text-white/40")}>
            {match.player2Legs}
          </span>
        </div>

        {/* P2 leg bar */}
        <div className="flex flex-col items-start gap-1">
          <p className="text-[11px] text-white/40 truncate max-w-[80px]">{p2?.name}</p>
          <div className="flex gap-1">
            {Array.from({ length: legsToWin }).map((_, i) => (
              <div key={i} className={cn("h-2 rounded-full transition-all", i < match.player2Legs ? "bg-primary w-5" : "bg-white/15 w-3")} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main: big remaining + stats ── */}
      <div className="grid grid-cols-2 divide-x divide-white/10 shrink-0">
        {[
          { id: p1Id, player: p1, rem: rem1, co: co1, last: last1, avg: getCurrentAvg(p1Throws) },
          { id: p2Id, player: p2, rem: rem2, co: co2, last: last2, avg: getCurrentAvg(p2Throws) },
        ].map(({ id, player, rem, co, last, avg }) => {
          const isActive = id === activeId && isOngoing
          const isWinner = isCompleted && match.winnerId === id
          return (
            <div key={id} className={cn("flex flex-col items-center py-5 px-3 relative transition-all", isActive ? "bg-primary/5" : "")}>
              {isActive && (
                <div className="absolute top-3 flex items-center gap-1 bg-primary/20 rounded-full px-2.5 py-0.5 border border-primary/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-primary">Шидэх ээлж</span>
                </div>
              )}
              {isWinner && <Trophy className="absolute top-3 h-4 w-4 text-yellow-400" />}

              <p className={cn("text-sm font-bold mt-7 mb-2 truncate max-w-full", isActive ? "text-white" : "text-white/50")}>
                {player?.name ?? "?"}
              </p>

              {/* Remaining — huge */}
              <p className={cn("text-[80px] leading-none font-black score-display",
                isActive ? "text-white" : isWinner ? "text-yellow-400" : "text-white/30")}>
                {rem}
              </p>

              {/* Checkout hint */}
              {co && isActive && (
                <div className="mt-2 bg-[oklch(0.78_0.16_85)]/20 border border-[oklch(0.78_0.16_85)]/30 rounded-lg px-3 py-1.5">
                  <p className="font-mono text-sm font-bold text-[oklch(0.78_0.16_85)]">{co}</p>
                </div>
              )}

              {/* Last 3 throws */}
              {last.length > 0 && (
                <div className="flex gap-1.5 mt-3">
                  {last.map((s, i) => (
                    <div key={i} className={cn("rounded-md px-2.5 py-1 border text-center min-w-[36px]",
                      isActive ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/10")}>
                      <p className={cn("text-base font-bold score-display", isActive ? "text-primary" : "text-white/40")}>{s}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-leg average */}
              <div className="mt-3 text-center">
                <p className="text-lg font-bold score-display text-white/70">{avg}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider">Дундаж</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Throw table ── */}
      <div className="flex-1 border-t border-white/10 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_40px_1fr] bg-white/5 text-[10px] text-white/30 font-semibold border-b border-white/10 uppercase tracking-widest">
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center border-r border-white/10">Оноо</div>
            <div className="px-2 py-1.5 text-center">Үлдсэн</div>
          </div>
          <div className="px-1 py-1.5 text-center border-x border-white/10">🎯</div>
          <div className="grid grid-cols-2">
            <div className="px-2 py-1.5 text-center border-l border-white/10">Үлдсэн</div>
            <div className="px-2 py-1.5 text-center">Оноо</div>
          </div>
        </div>
        <div ref={tableRef} className="overflow-y-auto max-h-40">
          {visitRows.map((row, i) => {
            const isP1 = row.p1s !== undefined
            return (
              <div key={i} className="grid grid-cols-[1fr_40px_1fr] border-b border-white/5 text-sm">
                <div className="grid grid-cols-2">
                  <div className={cn("px-2 py-1.5 text-center font-mono border-r border-white/5",
                    isP1 ? row.p1s! >= 100 ? "text-primary font-bold" : "text-white/80" : "text-white/15")}>
                    {isP1 ? row.p1s : "·"}
                  </div>
                  <div className="px-2 py-1.5 text-center font-mono text-white/40">
                    {isP1 && row.p1r !== undefined ? row.p1r : ""}
                  </div>
                </div>
                <div className="px-1 py-1.5 text-center text-[10px] font-mono text-white/25 border-x border-white/10">
                  {row.dartNo}
                </div>
                <div className="grid grid-cols-2">
                  <div className="px-2 py-1.5 text-center font-mono text-white/40 border-l border-white/5">
                    {!isP1 && row.p2r !== undefined ? row.p2r : ""}
                  </div>
                  <div className={cn("px-2 py-1.5 text-center font-mono",
                    !isP1 ? row.p2s! >= 100 ? "text-primary font-bold" : "text-white/80" : "text-white/15")}>
                    {!isP1 ? row.p2s : "·"}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="border-t border-white/10 px-3 py-2.5 shrink-0 bg-black/30">
        <div className="grid grid-cols-5 gap-1 text-center">
          <div>
            <p className="text-base font-bold score-display">{getAverage(p1Id)}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Avg</p>
          </div>
          <div>
            <p className="text-sm font-bold">{p1Ct * 3}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Дарт</p>
          </div>
          <div className="border-x border-white/10">
            <p className="text-xs font-bold text-white/50">{p1LegWins} — {p2LegWins}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Leg</p>
            {limitRounds && (
              <p className={cn("text-[9px] font-bold mt-0.5", visitRound >= limitRounds ? "text-yellow-400" : "text-white/30")}>
                {visitRound}/{limitRounds}v
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-bold">{p2Ct * 3}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Дарт</p>
          </div>
          <div>
            <p className="text-base font-bold score-display">{getAverage(p2Id)}</p>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Avg</p>
          </div>
        </div>

        {/* Leg history */}
        {match.legs.filter(l => l.winnerId).length > 0 && (
          <div className="flex gap-1 flex-wrap justify-center mt-2">
            {match.legs.filter(l => l.winnerId).map((leg, i) => (
              <div key={i} className="flex items-center gap-1 bg-white/5 rounded px-2 py-0.5 text-[10px]">
                <span className={cn(leg.winnerId === p1Id ? "text-primary font-bold" : "text-white/25")}>{p1?.name?.split(" ")[0]}</span>
                <span className="text-white/20">L{i+1}</span>
                <span className={cn(leg.winnerId === p2Id ? "text-primary font-bold" : "text-white/25")}>{p2?.name?.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-[9px] text-white/15 mt-1.5">
          {isOngoing ? "↻ Автоматаар шинэчлэгдэнэ" : "Тоглолт дууссан"}
        </p>
      </div>
    </div>
  )
}
