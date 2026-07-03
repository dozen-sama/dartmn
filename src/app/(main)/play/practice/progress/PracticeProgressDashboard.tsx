"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Flame, ListChecks, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { PRACTICE_PB_DIRECTION, PRACTICE_MODE_LABELS, type PracticeMode } from "@/lib/practice/practice-stats"
import type { PracticeSession } from "@/types/database"

interface SummaryRow {
  mode: string
  session_count: number
  best_metric: number
  worst_metric: number
  last_played: string
}

function computeStreak(dates: string[]): number {
  const daySet = new Set(dates.map(d => d.slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!daySet.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function PracticeProgressDashboard({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [recent, setRecent] = useState<PracticeSession[]>([])
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoggedIn(false); setLoading(false); return }

      const [{ data: summaryRows }, { data: sessions }] = await Promise.all([
        supabase.rpc("get_practice_stat_summary", { p_player_id: user.id }),
        supabase.from("practice_sessions").select("*")
          .eq("player_id", user.id).order("created_at", { ascending: false }).limit(20),
      ])

      setSummary((summaryRows ?? []) as SummaryRow[])
      const list = (sessions ?? []) as PracticeSession[]
      setRecent(list)
      setStreak(computeStreak(list.map(s => s.created_at)))
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-bold text-lg">Миний дэвшил</h1>
      </div>

      {loading && <p className="text-center text-sm text-muted-foreground py-10">Ачааллаж байна...</p>}

      {!loading && !loggedIn && (
        <p className="text-center text-sm text-muted-foreground py-10">
          Дадлагын явцаа хадгалахын тулд нэвтэрнэ үү
        </p>
      )}

      {!loading && loggedIn && (
        <>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Flame className={cn("h-8 w-8", streak > 0 ? "text-orange-400" : "text-muted-foreground")} />
              <div>
                <p className="text-2xl font-black score-display">{streak}</p>
                <p className="text-xs text-muted-foreground">өдөр дараалан дадлага хийсэн</p>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5 mb-2">
              <Trophy className="h-4 w-4 text-primary" /> Горим бүрийн хамгийн сайн үзүүлэлт
            </h2>
            {summary.length === 0 ? (
              <p className="text-xs text-muted-foreground">Одоогоор бэлтгэл хийгээгүй байна</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {summary.map(row => {
                  const mode = row.mode as PracticeMode
                  const direction = PRACTICE_PB_DIRECTION[mode] ?? "higher"
                  const best = direction === "higher" ? row.best_metric : row.worst_metric
                  return (
                    <div key={row.mode} className="bg-secondary/30 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-muted-foreground truncate">{PRACTICE_MODE_LABELS[mode] ?? row.mode}</p>
                      <p className="text-lg font-black score-display">{best}</p>
                      <p className="text-[10px] text-muted-foreground">{row.session_count} удаа · {formatDate(row.last_played)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5 mb-2">
              <ListChecks className="h-4 w-4 text-primary" /> Сүүлийн session-үүд
            </h2>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Session олдсонгүй</p>
            ) : (
              <div className="space-y-1.5">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-secondary/20 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium">{PRACTICE_MODE_LABELS[s.mode as PracticeMode] ?? s.mode}</span>
                    <span className="score-display font-bold">{s.headline_metric}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
