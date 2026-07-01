"use client"

import { useEffect, useState } from "react"
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

  if (!room) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  const startScore = parseInt(room.format) || 501
  const legsToWin = Math.ceil(room.best_of / 2)

  const game = deriveX01(
    visits.map((v) => v.points === -1 ? { points: 0, darts: 0, decide: v.team } : { points: v.points, darts: v.darts }),
    {
      startScore,
      doubleOut: room.double_out,
      legsToWin,
      starterTeam: room.starter_team ?? 0,
      teamSizes: [1, 1],
      limitRoundsEnabled: room.limit_rounds != null,
      limitRounds: room.limit_rounds ?? undefined,
      bullFinishAtLimit: room.bull_finish,
    }
  )

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

      {/* Player rows */}
      {[0, 1].map((team) => {
        const isActive = !game.winner && game.activeTeam === team
        const remaining = game.scores[team]
        const legs = game.legs[team]
        const avg = teamAvg[team]

        return (
          <div key={team} className={cn(
            "flex items-center gap-2 rounded-lg",
            large ? "px-4 py-4" : "px-3 py-2.5",
            isActive ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"
          )}>
            {/* Active indicator */}
            <span className={cn(
              "rounded-full shrink-0",
              large ? "h-4 w-4" : "h-2.5 w-2.5",
              isActive ? "bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]" : "bg-muted-foreground/20"
            )} />

            {/* Name + avg */}
            <span className={cn("flex-1 min-w-0 font-medium truncate", large ? "text-xl" : "text-sm")}>
              {names[team]}
              <span className={cn("text-muted-foreground ml-1 font-normal", large ? "text-sm" : "text-[11px]")}>
                ({avg > 0 ? avg.toFixed(2) : "—"})
              </span>
            </span>

            {/* Legs won */}
            <span className={cn("font-bold text-center shrink-0", large ? "text-2xl w-8" : "text-sm w-5")}>{legs}</span>

            {/* Remaining score */}
            <span className={cn(
              "font-bold text-center rounded px-1 bg-blue-500/20 text-blue-300 shrink-0",
              large ? "text-4xl w-24" : "text-lg w-14"
            )}>
              {remaining}
            </span>

            {/* Arrow */}
            <span className={cn(large ? "text-2xl" : "text-base", "shrink-0", isActive ? "text-pink-400" : "text-muted-foreground/20")}>
              ▶
            </span>
          </div>
        )
      })}

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
