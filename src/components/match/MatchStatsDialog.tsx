"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatAverage } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import type { MatchStatDetails } from "@/lib/local-game/match-stat-details"
import type { MatchStatDetail } from "@/types/database"

export interface MatchStatSide {
  name: string
  stats: MatchStatDetails
}

export interface MatchStatComparison {
  contextLabel: string | null
  p1: MatchStatSide
  p2: MatchStatSide
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Post-match popup: клиент дээр шууд тооцоолсон өгөгдөл (DB хүлээхгүй)
  data?: MatchStatComparison | null
  // Профайл Түүх-ээс: match_key-аар DB-ээс fetch хийнэ. selfPlayerId/selfName нь "Түүх"
  // эзэмшигч тоглогчийг тодорхойлж, opponent unlinked (guest) үед ч зөв нэр (opponent_name
  // талбар зөвхөн ӨРСӨЛДӨГЧИЙН нэрийг агуулдаг, өөрийн нэрийг биш) харуулна.
  matchKey?: string
  selfPlayerId?: string
  selfName?: string
}

function rowFromDb(row: MatchStatDetail): MatchStatDetails {
  return {
    legsFor: row.legs_for, legsAgainst: row.legs_against,
    dartsThrown: row.darts_thrown, pointsScored: row.points_scored,
    avg3: row.avg3, avgFirst9: row.avg_first9,
    band60: row.band_60, band80: row.band_80, band100: row.band_100,
    band120: row.band_120, band140: row.band_140, band170: row.band_170,
    count180: row.count_180,
    highFinish: row.high_finish, count100Finishes: row.count_100_finishes,
    bestLegDarts: row.best_leg_darts, worstLegDarts: row.worst_leg_darts,
    checkoutAttempts: row.checkout_attempts, checkoutMakes: row.checkout_makes,
    keepAttempts: row.keep_attempts, keepMakes: row.keep_makes,
    breakAttempts: row.break_attempts, breakMakes: row.break_makes,
  }
}

const EMPTY_STATS: MatchStatDetails = {
  legsFor: 0, legsAgainst: 0, dartsThrown: 0, pointsScored: 0, avg3: 0, avgFirst9: 0,
  band60: 0, band80: 0, band100: 0, band120: 0, band140: 0, band170: 0, count180: 0,
  highFinish: 0, count100Finishes: 0, bestLegDarts: null, worstLegDarts: null,
  checkoutAttempts: 0, checkoutMakes: 0, keepAttempts: 0, keepMakes: 0, breakAttempts: 0, breakMakes: 0,
}

function pct(makes: number, attempts: number): string {
  return attempts > 0 ? `${((makes / attempts) * 100).toFixed(1)}%` : "0.0%"
}

export function MatchStatsDialog({ open, onOpenChange, data, matchKey, selfPlayerId, selfName }: Props) {
  const [fetched, setFetched] = useState<MatchStatComparison | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || data || !matchKey) return
    setLoading(true)
    const supabase = createClient()
    supabase.from("match_stat_details").select("*").eq("match_key", matchKey)
      .then(({ data: rows }) => {
        const list = (rows ?? []) as MatchStatDetail[]
        if (list.length === 0) { setFetched(null); setLoading(false); return }
        // selfRow — "Түүх" эзэмшигчийн мөр (selfPlayerId-аар олно, эсвэл list[0]).
        // opponentRow үргэлж байхгүй байж болно (өрсөлдөгч unlinked/guest бол зөвхөн
        // 1 мөр л бичигдсэн байна) — opponent_name талбар зөвхөн ӨРСӨЛДӨГЧИЙН нэрийг
        // агуулдаг тул selfRow.opponent_name-ийг p2-д ашиглана, self-ийн нэрийг DB-ээс
        // авах боломжгүй тул selfName prop-оор нөхнө.
        const selfRow = (selfPlayerId ? list.find((r) => r.player_id === selfPlayerId) : list[0]) ?? list[0]
        const opponentRow = list.find((r) => r.id !== selfRow.id)
        setFetched({
          contextLabel: selfRow.context_label,
          p1: { name: selfName ?? opponentRow?.opponent_name ?? "?", stats: rowFromDb(selfRow) },
          p2: opponentRow
            ? { name: selfRow.opponent_name, stats: rowFromDb(opponentRow) }
            : { name: selfRow.opponent_name, stats: EMPTY_STATS },
        })
        setLoading(false)
      })
  }, [open, data, matchKey, selfPlayerId, selfName])

  const comparison = data ?? fetched

  const rows: { label: string; get: (s: MatchStatDetails) => string }[] = [
    { label: "Legs", get: (s) => String(s.legsFor) },
    { label: "3 Darts", get: (s) => formatAverage(s.avg3) },
    { label: "First 9", get: (s) => formatAverage(s.avgFirst9) },
    { label: "60+", get: (s) => String(s.band60) },
    { label: "80+", get: (s) => String(s.band80) },
    { label: "100+", get: (s) => String(s.band100) },
    { label: "120+", get: (s) => String(s.band120) },
    { label: "140+", get: (s) => String(s.band140) },
    { label: "170+", get: (s) => String(s.band170) },
    { label: "180's", get: (s) => String(s.count180) },
    { label: "High Finish", get: (s) => String(s.highFinish) },
    { label: "100+ Finishes", get: (s) => String(s.count100Finishes) },
    { label: "Best Leg", get: (s) => (s.bestLegDarts !== null ? String(s.bestLegDarts) : "—") },
    { label: "Worst Leg", get: (s) => (s.worstLegDarts !== null ? String(s.worstLegDarts) : "—") },
    { label: "Checkout Prediction", get: (s) => `${pct(s.checkoutMakes, s.checkoutAttempts)} (${s.checkoutMakes}/${s.checkoutAttempts})` },
    { label: "Keep", get: (s) => `${pct(s.keepMakes, s.keepAttempts)} (${s.keepMakes}/${s.keepAttempts})` },
    { label: "Break", get: (s) => `${pct(s.breakMakes, s.breakAttempts)} (${s.breakMakes}/${s.breakAttempts})` },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {comparison?.contextLabel && (
            <p className="text-center text-xs text-muted-foreground">{comparison.contextLabel}</p>
          )}
          <DialogTitle className="sr-only">Тоглолтын дэлгэрэнгүй статистик</DialogTitle>
          {comparison && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <p className="font-bold text-sm truncate">{comparison.p1.name}</p>
              <p className="font-bold text-sm truncate">{comparison.p2.name}</p>
            </div>
          )}
        </DialogHeader>

        {loading && !comparison && (
          <p className="text-center text-sm text-muted-foreground py-6">Ачааллаж байна...</p>
        )}
        {!loading && !comparison && (
          <p className="text-center text-sm text-muted-foreground py-6">Статистик олдсонгүй</p>
        )}

        {comparison && (
          <div className="rounded-lg border border-border/40 overflow-hidden text-sm">
            {rows.map((row, i) => (
              <div key={row.label}
                className={cn("grid grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5",
                  i % 2 === 0 ? "bg-secondary/20" : "")}>
                <span className="text-right score-display tabular-nums">{row.get(comparison.p1.stats)}</span>
                <span className="px-3 text-[11px] text-muted-foreground text-center whitespace-nowrap">{row.label}</span>
                <span className="text-left score-display tabular-nums">{row.get(comparison.p2.stats)}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
