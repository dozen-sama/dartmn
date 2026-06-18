"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Play, Eye, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BracketMatch, BracketEntrant } from "@/hooks/useTournamentBracket"

interface Props {
  tournamentId: string
  status: string
  isOrganizer: boolean
  currentUserId: string | null
  bracketType: string
  matches: BracketMatch[]
  entrants: Record<string, BracketEntrant>
  playerEntrant: Record<string, string>
  loading: boolean
}

export function BracketView({ tournamentId, status, isOrganizer, currentUserId, bracketType, matches, entrants, playerEntrant, loading }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myEntrant = currentUserId ? playerEntrant[currentUserId] : undefined
  const nameOf = (id: string | null) => (id ? entrants[id]?.display_name ?? "?" : null)

  async function startTournament() {
    setBusy("tournament"); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/start`, { method: "POST" })
      const j = await res.json()
      if (!res.ok) setError(j.error ?? "Алдаа гарлаа")
    } finally { setBusy(null) }
  }

  async function startMatch(m: BracketMatch) {
    setBusy(m.id); setError(null)
    try {
      // Аль хэдийн room-тай бол шууд орно
      if (m.room_id) { router.push(`/play/${m.room_id}`); return }
      const res = await fetch(`/api/tournaments/${tournamentId}/match/${m.id}/start`, { method: "POST" })
      const j = await res.json()
      if (res.ok && j.roomId) router.push(`/play/${j.roomId}`)
      else setError(j.error ?? "Тоглолт эхлүүлэхэд алдаа гарлаа")
    } finally { setBusy(null) }
  }

  if (status === "registration" || status === "draft") {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Trophy className="h-12 w-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60">Тэмцээн эхэлсний дараа bracket гарна</p>
          {isOrganizer && (
            <>
              <Button onClick={startTournament} disabled={busy === "tournament"}>
                {busy === "tournament" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Тэмцээн эхлүүлэх
              </Button>
              {bracketType !== "single_elimination" && (
                <p className="text-xs text-muted-foreground/60">Одоогоор зөвхөн шигшээ (single elimination) эхлүүлэх боломжтой</p>
              )}
            </>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <Card className="border-border/50 bg-card/80"><CardContent className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
  }

  // Round-аар бүлэглэх (winners bracket)
  const rounds = [...new Set(matches.filter((m) => !m.is_losers_bracket).map((m) => m.round))].sort((a, b) => a - b)
  const maxRound = rounds[rounds.length - 1]

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {rounds.map((round) => (
        <Card key={round} className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {round === maxRound ? "Финал" : `Тойрог ${round}`}
            </p>
            {matches.filter((m) => !m.is_losers_bracket && m.round === round).map((m) => {
              const s1 = nameOf(m.side1_entrant_id)
              const s2 = nameOf(m.side2_entrant_id)
              const ready = !!m.side1_entrant_id && !!m.side2_entrant_id && m.status === "pending"
              const mine = myEntrant && (m.side1_entrant_id === myEntrant || m.side2_entrant_id === myEntrant)
              const win1 = m.winner_entrant_id && m.winner_entrant_id === m.side1_entrant_id
              const win2 = m.winner_entrant_id && m.winner_entrant_id === m.side2_entrant_id
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <Side name={s1} legs={m.side1_legs} win={!!win1} done={m.status === "completed"} />
                    <Side name={s2} legs={m.side2_legs} win={!!win2} done={m.status === "completed"} />
                  </div>
                  <div className="shrink-0">
                    {m.status === "completed" ? (
                      <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">Дууссан</Badge>
                    ) : m.status === "ongoing" ? (
                      <Button size="sm" variant={mine ? "default" : "outline"} onClick={() => startMatch(m)} disabled={busy === m.id}>
                        {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mine ? <><Play className="h-3.5 w-3.5 mr-1" />Орох</> : <><Eye className="h-3.5 w-3.5 mr-1" />Үзэх</>}
                      </Button>
                    ) : ready && (mine || isOrganizer) ? (
                      <Button size="sm" onClick={() => startMatch(m)} disabled={busy === m.id}>
                        {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Play className="h-3.5 w-3.5 mr-1" />Эхлүүлэх</>}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground/60">
                        {ready ? "Хүлээж байна" : "Бэлэн биш"}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Side({ name, legs, win, done }: { name: string | null; legs: number; win: boolean; done: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 text-sm", win && "font-semibold text-primary")}>
      <span className={cn("truncate", !name && "text-muted-foreground/50 italic")}>{name ?? "Хүлээгдэж байна"}</span>
      {done && <span className="score-display text-xs tabular-nums shrink-0">{legs}</span>}
    </div>
  )
}
