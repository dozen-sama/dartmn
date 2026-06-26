"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trophy, Wifi, WifiOff } from "lucide-react"
import { useLocalGame } from "@/lib/local-game/store"
import { fetchRemoteSession, subscribeToSession } from "@/lib/local-game/sync"
import { getCheckout } from "@/lib/local-game/checkouts"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { LocalSession, LocalLeg, LegThrow } from "@/lib/local-game/types"

export function LiveView() {
  const { sessionId, matchId } = useParams<{ sessionId: string; matchId: string }>()
  const [mounted, setMounted] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const [remoteSession, setRemoteSession] = useState<LocalSession | null>(null)
  const [syncStatus, setSyncStatus] = useState<"local" | "remote" | "none">("none")

  // Local Zustand state (same device)
  const localSession = useLocalGame((s) => s.sessions[sessionId])

  useEffect(() => { setMounted(true) }, [])

  // Always subscribe to realtime (Zustand is per-tab, realtime crosses tabs/devices)
  useEffect(() => {
    if (!mounted) return

    fetchRemoteSession(sessionId).then((s) => {
      if (s) { setRemoteSession(s); setSyncStatus("remote") }
      else if (localSession) setSyncStatus("local")
    })

    const unsub = subscribeToSession(sessionId, (s) => {
      setRemoteSession(s)
      setSyncStatus("remote")
    })

    return unsub
  }, [mounted, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Remote always wins (broadcast on every throw), fall back to local
  const session = remoteSession ?? localSession

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
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      <p className="text-white/50 text-sm">Тоглолт хайж байна...</p>
      <p className="text-white/25 text-xs">Тоглолт олдоогүй бол хуучин хуудас руу буцна</p>
      <Link href="/local" className={cn(buttonVariants({ variant: "ghost" }), "text-white/40 text-sm")}>Буцах</Link>
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
  const currentLeg: Pick<LocalLeg, "throws" | "winnerId"> = match.legs[completedLegs] ?? { throws: {}, winnerId: null }

  const p1Throws: LegThrow[] = currentLeg.throws?.[p1Id] ?? []
  const p2Throws: LegThrow[] = currentLeg.throws?.[p2Id] ?? []
  const maxVisits = Math.max(p1Throws.length, p2Throws.length)

  // bust онооны тоологдохгүй
  function getRemaining(throws: LegThrow[]): number {
    return startScore - throws.reduce((a, t) => a + (t.bust ? 0 : (t.score ?? 0)), 0)
  }

  function getAverage(playerId: string): string {
    const all: number[] = match!.legs.flatMap((leg) =>
      (leg.throws?.[playerId] ?? []).map((t) => t.bust ? 0 : (t.score ?? 0))
    )
    if (!all.length) return "—"
    return (all.reduce((a, s) => a + s, 0) / all.length * 3).toFixed(1)
  }

  function getCurrentAvg(throws: LegThrow[]): string {
    if (!throws.length) return "—"
    const sum = throws.reduce((a, t) => a + (t.bust ? 0 : (t.score ?? 0)), 0)
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

  const visitRound = Math.max(p1Ct, p2Ct)

  // P1 leg wins across all legs
  const p1LegWins = match.legs.filter(l => l.winnerId === p1Id).length
  const p2LegWins = match.legs.filter(l => l.winnerId === p2Id).length

  // Last 3 throws per player in current leg
  const last1 = p1Throws.slice(-3).map((t) => ({ score: t.score ?? 0, bust: !!t.bust }))
  const last2 = p2Throws.slice(-3).map((t) => ({ score: t.score ?? 0, bust: !!t.bust }))

  const isOngoing   = match.status === "ongoing"
  const isCompleted = match.status === "completed"

  // History cell — оноо (bust зураастай, checkout ногоон)
  const histCell = (t: LegThrow | undefined, side: 0 | 1) => {
    if (!t) return <div className="h-8" />
    const checkout = !t.bust && t.remaining === 0
    return (
      <div className={cn("h-8 flex items-center", side === 0 ? "justify-end pr-3" : "justify-start pl-3")}>
        <span className={cn("text-2xl font-bold score-display leading-none",
          t.bust ? "text-red-500/50 line-through" : checkout ? "text-green-400" : "text-white/85")}>
          {t.score}
        </span>
      </div>
    )
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
          <div className="flex items-center gap-1.5">
          {syncStatus === "remote" && (
            <span title="Realtime sync" className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Wifi className="h-3 w-3" />
            </span>
          )}
          {syncStatus === "local" && (
            <span title="Local" className="flex items-center gap-1 text-[10px] text-sky-400">
              <WifiOff className="h-3 w-3" />
            </span>
          )}
          {isOngoing && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />LIVE
            </span>
          )}
          {isCompleted && <span className="text-[11px] font-bold text-green-400">ДУУССАН</span>}
        </div>
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
                      <p className={cn("text-base font-bold score-display",
                        s.bust ? "text-red-500/50 line-through" : isActive ? "text-primary" : "text-white/40")}>{s.score}</p>
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

      {/* ── History: оноо | round# | оноо ── */}
      <div className="flex-1 border-t border-white/10 overflow-hidden">
        <div ref={tableRef} className="overflow-y-auto max-h-full py-1.5">
          {Array.from({ length: maxVisits }).map((_, i) => {
            const first = i === 0
            const last = i === maxVisits - 1
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center">
                {histCell(p1Throws[i], 0)}
                <span className={cn("h-8 w-7 flex items-center justify-center text-xs font-bold bg-white/10 text-white/50 justify-self-center",
                  first && "rounded-t", last && "rounded-b")}>
                  {i + 1}
                </span>
                {histCell(p2Throws[i], 1)}
              </div>
            )
          })}
          {maxVisits === 0 && (
            <p className="text-center text-white/20 text-xs py-6">Эхний шидэлтийг хүлээж байна…</p>
          )}
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
