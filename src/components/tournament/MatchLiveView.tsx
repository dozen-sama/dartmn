"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { deriveX01 } from "@/lib/local-game/x01"
import { cn } from "@/lib/utils"
import type { BracketEntrant } from "@/hooks/useTournamentBracket"

interface Props {
  roomId: string
  side1EntrantId: string | null
  side2EntrantId: string | null
  entrants: Record<string, BracketEntrant>
  large?: boolean
}

interface RoomSnap {
  format: string
  best_of: number
  double_out: boolean
  starter_team: number | null
  limit_rounds: number | null
  bull_finish: boolean
  status: string
}

interface Visit {
  seq: number
  team: number
  points: number
  darts: number
}

export function MatchLiveView({ roomId, side1EntrantId, side2EntrantId, entrants, large = false }: Props) {
  const [supabase] = useState(() => createClient())
  const [room, setRoom] = useState<RoomSnap | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const [highlight, setHighlight] = useState({ top: 0, height: 0 })

  useEffect(() => {
    supabase.from("online_rooms")
      .select("format, best_of, double_out, starter_team, limit_rounds, bull_finish, status")
      .eq("id", roomId).maybeSingle()
      .then(({ data }) => { if (data) setRoom(data as RoomSnap) })

    supabase.from("room_visits")
      .select("seq, team, points, darts")
      .eq("room_id", roomId).order("seq")
      .then(({ data }) => { if (data) setVisits(data as Visit[]) })

    const ch = supabase.channel(`match-live-${roomId}`)
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "room_visits", filter: `room_id=eq.${roomId}` }, (payload) => {
      const v = payload.new as Visit
      setVisits((prev) => prev.some((x) => x.seq === v.seq) ? prev : [...prev, v].sort((a, b) => a.seq - b.seq))
    })
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "room_visits", filter: `room_id=eq.${roomId}` }, () => {
      supabase.from("room_visits").select("seq, team, points, darts")
        .eq("room_id", roomId).order("seq")
        .then(({ data }) => { if (data) setVisits(data as Visit[]) })
    })
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "online_rooms", filter: `id=eq.${roomId}` }, (payload) => {
      setRoom((prev) => prev ? { ...prev, ...(payload.new as Partial<RoomSnap>) } : prev)
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, supabase])

  const game = room ? deriveX01(
    visits.map((v) => v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts }),
    {
      startScore: parseInt(room.format) || 501,
      doubleOut: room.double_out,
      legsToWin: Math.ceil(room.best_of / 2),
      starterTeam: room.starter_team ?? 0,
      teamSizes: [1, 1],
      limitRoundsEnabled: room.limit_rounds != null,
      limitRounds: room.limit_rounds ?? undefined,
      bullFinishAtLimit: room.bull_finish,
    }
  ) : null

  // Идэвхтэй тоглогчийн highlight-ыг мөрүүдийн хооронд зөөлөн шилжүүлнэ
  useEffect(() => {
    if (!game || game.winner !== null) return
    const activeEl = rowRefs.current[game.activeTeam]
    if (activeEl) setHighlight({ top: activeEl.offsetTop, height: activeEl.offsetHeight })
  }, [game, large])

  if (!room || !game) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  const legsToWin = Math.ceil(room.best_of / 2)

  // Per-team average: bust visits score 0 but darts count; cross-ref with raw visits via idx
  const allViews = game.legsView.flat()
  const teamAvg = [0, 1].map((team) => {
    const tv = allViews.filter((v) => v.team === team)
    const scored = tv.reduce((s, v) => s + (v.bust ? 0 : v.points), 0)
    const darts = tv.reduce((s, v) => s + (visits[v.idx]?.darts ?? 3), 0)
    return darts > 0 ? (scored / darts) * 3 : 0
  })

  const entrantIds = [side1EntrantId, side2EntrantId]
  const names = entrantIds.map((id) => id ? (entrants[id]?.display_name ?? "?") : "?")
  const currentLeg = game.legs[0] + game.legs[1] + 1

  // Одоогийн leg-ийн сүүлийн 3 ээлж (шинэ нь эхэнд)
  const activeLegView = game.legsView[game.legsView.length - 1] ?? []
  const recentVisits = activeLegView.slice(-3).reverse()

  return (
    <div className={cn("space-y-3", large && "space-y-6 max-w-md mx-auto w-full")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between text-muted-foreground px-1", large ? "text-sm" : "text-[11px]")}>
        <span>First to {legsToWin} Legs</span>
        <span className="font-medium">Legs</span>
        <span className="text-foreground/60">({currentLeg})</span>
      </div>

      {/* Player rows — идэвхтэй тоглогчийн highlight мөрүүдийн хооронд зөөлөн шилжинэ */}
      <div className="relative">
        <div
          className="absolute inset-x-0 rounded-lg bg-primary/10 border border-primary/20 transition-[transform,opacity] duration-300 ease-out"
          style={{
            transform: `translateY(${highlight.top}px)`,
            height: highlight.height || undefined,
            opacity: game.winner !== null ? 0 : 1,
          }}
        />
        <div className={cn("relative space-y-3", large && "space-y-6")}>
          {[0, 1].map((team) => {
            const isActive = !game.winner && game.activeTeam === team
            const remaining = game.scores[team]
            const legs = game.legs[team]
            const avg = teamAvg[team]

            const dot = (
              <span className={cn(
                "rounded-full shrink-0 transition-colors duration-300",
                large ? "h-4 w-4" : "h-2.5 w-2.5",
                isActive ? "bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]" : "bg-muted-foreground/20"
              )} />
            )
            const arrow = (
              <span className={cn(
                "shrink-0 transition-colors duration-300",
                large ? "text-2xl" : "text-base",
                isActive ? "text-pink-400" : "text-muted-foreground/20"
              )}>
                ▶
              </span>
            )

            // Fullscreen горимд нэрийг тусдаа мөрөнд гаргаж, ямар ч урттай нэр
            // legs/score/сум-ын өргөнтэй өрсөлдөхгүйгээр бүрэн харагдана
            if (large) {
              return (
                <div key={team} ref={(el) => { rowRefs.current[team] = el }} className="flex flex-col gap-2 px-4 py-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    {dot}
                    <span className="flex-1 min-w-0 truncate text-xl font-medium">{names[team]}</span>
                    <span className="shrink-0 text-sm text-muted-foreground font-normal">
                      ({avg > 0 ? avg.toFixed(2) : "—"})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pl-6">
                    <span className="font-bold text-2xl w-8 text-center shrink-0">{legs}</span>
                    <span className="flex-1 font-bold text-4xl text-center rounded px-1 bg-blue-500/20 text-blue-300">
                      {remaining}
                    </span>
                    {arrow}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={team}
                ref={(el) => { rowRefs.current[team] = el }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              >
                {dot}

                {/* Name + avg */}
                <span className="flex-1 min-w-0 font-medium truncate text-sm">
                  {names[team]}
                  <span className="text-muted-foreground ml-1 font-normal text-[11px]">
                    ({avg > 0 ? avg.toFixed(2) : "—"})
                  </span>
                </span>

                {/* Legs won */}
                <span className="font-bold text-center shrink-0 text-sm w-5">{legs}</span>

                {/* Remaining score */}
                <span className="font-bold text-center rounded px-1 bg-blue-500/20 text-blue-300 shrink-0 text-lg w-14">
                  {remaining}
                </span>

                {arrow}
              </div>
            )
          })}
        </div>
      </div>

      {game.winner !== null && (
        <p className={cn("text-center text-muted-foreground", large ? "text-lg" : "text-sm")}>
          <span className="font-medium text-foreground">{names[game.winner]}</span> ялалт байгуулав
        </p>
      )}

      {/* Сүүлийн 3 ээлжийн оноо */}
      {recentVisits.length > 0 && (
        <div className={cn("space-y-1", large && "pt-2")}>
          <p className={cn("text-muted-foreground uppercase tracking-wide px-1", large ? "text-xs" : "text-[10px]")}>
            Сүүлийн ээлжүүд
          </p>
          <div className={cn("flex gap-2", large ? "flex-row" : "flex-col")}>
            {recentVisits.map((v) => (
              <div key={v.idx} className={cn(
                "flex items-center justify-between rounded bg-secondary/20",
                large ? "flex-1 flex-col gap-1 px-3 py-3" : "px-2 py-1 text-xs"
              )}>
                <span className={cn("truncate text-muted-foreground", large ? "text-sm" : "")}>{names[v.team]}</span>
                <span className={cn(
                  "font-bold score-display",
                  large ? "text-2xl" : "",
                  v.bust ? "text-destructive" : v.checkout ? "text-green-400" : "text-foreground"
                )}>
                  {v.bust ? "BUST" : v.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
