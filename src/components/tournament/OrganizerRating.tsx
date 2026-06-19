"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// 1=гомдол ... 5=сайшаал
export const RATING_OPTIONS = [
  { value: 1, emoji: "😠", label: "Гомдолтой" },
  { value: 2, emoji: "😕", label: "Сэтгэл дундуур" },
  { value: 3, emoji: "😐", label: "Боломжийн" },
  { value: 4, emoji: "🙂", label: "Сэтгэл хангалуун" },
  { value: 5, emoji: "🤩", label: "Сайшаалтай" },
]

interface Props {
  tournamentId: string
  organizerId: string
  currentUserId: string | null
  canRate: boolean // registered participant, completed, биш зохион байгуулагч
}

export function OrganizerRating({ tournamentId, organizerId, currentUserId, canRate }: Props) {
  const [loading, setLoading] = useState(false)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [payoutPick, setPayoutPick] = useState<"paid" | "unpaid" | null>(null)
  const [comment, setComment] = useState("")
  const [stats, setStats] = useState<{ count: number; avg: number; dist: Record<number, number>; paid: number; unpaid: number }>({ count: 0, avg: 0, dist: {}, paid: 0, unpaid: 0 })

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from("organizer_ratings")
      .select("rating, rater_id, comment, payout_status").eq("organizer_id", organizerId)
    const rows = data ?? []
    const dist: Record<number, number> = {}
    let sum = 0, paid = 0, unpaid = 0
    for (const r of rows) {
      dist[r.rating] = (dist[r.rating] ?? 0) + 1; sum += r.rating
      if (r.payout_status === "paid") paid++
      else if (r.payout_status === "unpaid") unpaid++
    }
    setStats({ count: rows.length, avg: rows.length ? sum / rows.length : 0, dist, paid, unpaid })
    const mine = rows.find((r) => r.rater_id === currentUserId)
    if (mine) { setMyRating(mine.rating); setPick(mine.rating); setComment(mine.comment ?? ""); setPayoutPick(mine.payout_status ?? null) }
  }

  useEffect(() => {
    // setState нь await-ийн дараа (синхрон биш) — fetch-based sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [organizerId, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!pick || !currentUserId) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from("organizer_ratings").upsert({
      tournament_id: tournamentId, organizer_id: organizerId, rater_id: currentUserId,
      rating: pick, payout_status: payoutPick, comment: comment.trim() || null,
    }, { onConflict: "tournament_id,rater_id" })
    setLoading(false)
    if (error) return toast.error("Үнэлгээ илгээхэд алдаа гарлаа")
    toast.success("Үнэлгээ илгээгдлээ")
    setMyRating(pick)
    load()
  }

  return (
    <div className="space-y-4">
      {/* Нэгдсэн дүн */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-center shrink-0">
              <p className="text-3xl font-black score-display text-[oklch(0.78_0.16_85)]">{stats.avg.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">{stats.count} үнэлгээ</p>
            </div>
            <div className="flex-1 space-y-1">
              {RATING_OPTIONS.slice().reverse().map((o) => {
                const c = stats.dist[o.value] ?? 0
                const pct = stats.count ? (c / stats.count) * 100 : 0
                return (
                  <div key={o.value} className="flex items-center gap-2 text-xs">
                    <span className="w-5 shrink-0">{o.emoji}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                      <div className="h-full bg-[oklch(0.78_0.16_85)]/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-right text-muted-foreground tabular-nums">{c}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Шагнал төлөлтийн баталгаа */}
          {(stats.paid > 0 || stats.unpaid > 0) && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">💰 Шагнал төлөлт:</span>
              <span className="flex items-center gap-1 text-green-400 font-medium">✓ Төлсөн {stats.paid}</span>
              <span className="flex items-center gap-1 text-destructive font-medium">✗ Төлөөгүй {stats.unpaid}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Үнэлгээ өгөх (зөвхөн дууссан тэмцээнд оролцсон тоглогч) */}
      {canRate && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">{myRating ? "Таны үнэлгээ" : "Зохион байгуулагчийг үнэлэх"}</p>
            <div className="grid grid-cols-5 gap-2">
              {RATING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPick(o.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-2 py-2 transition-all",
                    pick === o.value ? "border-primary bg-primary/15" : "border-border/50 hover:border-border bg-secondary/30"
                  )}
                >
                  <span className="text-xl">{o.emoji}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">{o.label}</span>
                </button>
              ))}
            </div>
            {/* Шагнал авсан эсэх (winner-ийн баталгаа; хожоогүй бол хамаарахгүй) */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Шагналаа авсан уу?</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "paid" as const, label: "✓ Авсан", active: "border-green-500 bg-green-500/15 text-green-400" },
                  { v: "unpaid" as const, label: "✗ Аваагүй", active: "border-destructive bg-destructive/15 text-destructive" },
                  { v: null, label: "Хамаарахгүй", active: "border-primary bg-primary/15" },
                ]).map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setPayoutPick(o.v)}
                    className={cn(
                      "rounded-lg border-2 py-1.5 text-xs font-medium transition-all",
                      payoutPick === o.v ? o.active : "border-border/50 hover:border-border bg-secondary/30 text-muted-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Сэтгэгдэл (заавал биш)..." rows={2}
              className="w-full rounded-md bg-secondary/50 border border-border/60 text-sm resize-none px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button onClick={submit} disabled={loading || !pick} className="glow-primary">
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {myRating ? "Үнэлгээ шинэчлэх" : "Үнэлгээ илгээх"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
