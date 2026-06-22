"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Play, Eye, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BracketMatch, BracketEntrant } from "@/hooks/useTournamentBracket"
import { computeStandings } from "@/lib/tournament/standings"

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

  async function advanceKnockout() {
    setBusy("knockout"); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/advance-knockout`, { method: "POST" })
      const j = await res.json()
      if (!res.ok) setError(j.error ?? "Алдаа гарлаа")
    } finally { setBusy(null) }
  }

  async function swissAction(action: "next-round" | "finish") {
    setBusy(action); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/${action}`, { method: "POST" })
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
              {!["single_elimination", "round_robin", "groups_knockout", "swiss"].includes(bracketType) && (
                <p className="text-xs text-muted-foreground/60">Энэ bracket төрөл одоогоор эхлүүлэх боломжгүй (удахгүй)</p>
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

  const isElimination = bracketType === "single_elimination" || bracketType === "double_elimination"
  const isGroups = bracketType === "groups_knockout"

  // Нэг match-ийн мөрийг зурна (бүх bracket төрөлд дахин ашиглана)
  function renderMatch(m: BracketMatch) {
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
  }

  // ── Groups + Knockout ────────────────────────────────────────────
  if (isGroups) {
    const groupNos = [...new Set(matches.map((m) => m.group_no).filter((g): g is number => g != null))].sort((a, b) => a - b)
    const groupMatches = matches.filter((m) => m.group_no != null)
    const koMatches = matches.filter((m) => m.group_no == null)
    const koMinRound = koMatches.length ? Math.min(...koMatches.map((m) => m.round)) : 0
    const koMaxRound = koMatches.length ? Math.max(...koMatches.map((m) => m.round)) : 0
    const koRounds = [...new Set(koMatches.map((m) => m.round))].sort((a, b) => a - b)
    const allGroupDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed")
    const koSeeded = koMatches.filter((m) => m.round === koMinRound).some((m) => m.side1_entrant_id || m.side2_entrant_id)

    return (
      <div className="space-y-4">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Бүлгүүд */}
        {groupNos.map((gno) => {
          const groupEntrantIds = Object.values(entrants).filter((e) => e.group_no === gno).map((e) => e.id)
          const groupStanding = computeStandings(groupEntrantIds, groupMatches.filter((m) => m.group_no === gno))
          const gLabel = `Бүлэг ${String.fromCharCode(64 + gno)}`
          return (
            <div key={gno} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{gLabel}</p>
              {groupStanding.length > 0 && (
                <StandingsTable rows={groupStanding} nameOf={(id) => entrants[id]?.display_name ?? "?"} myEntrant={myEntrant} />
              )}
              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-4 space-y-2">
                  {groupMatches.filter((m) => m.group_no === gno).sort((a, b) => a.round - b.round || a.match_number - b.match_number).map(renderMatch)}
                </CardContent>
              </Card>
            </div>
          )
        })}

        {/* Шигшээнд дэвших */}
        {isOrganizer && allGroupDone && !koSeeded && (
          <Card className="border-primary/40 bg-card/80">
            <CardContent className="flex flex-col items-center gap-2 py-5">
              <p className="text-sm text-muted-foreground">Бүлгийн шат дууслаа</p>
              <Button onClick={advanceKnockout} disabled={busy === "knockout"}>
                {busy === "knockout" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Шигшээ шатанд дэвших
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Шигшээ (KO) */}
        {koSeeded && koRounds.map((round) => (
          <Card key={`ko-${round}`} className="border-border/50 bg-card/80">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {round === koMaxRound ? "Финал" : `Шигшээ ${round - koMinRound + 1}`}
              </p>
              {koMatches.filter((m) => m.round === round).sort((a, b) => a.match_number - b.match_number).map(renderMatch)}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ── Double Elimination ───────────────────────────────────────────
  if (bracketType === "double_elimination") {
    const wbMatches = matches.filter((m) => !m.is_losers_bracket && m.round < 200)
    const lbMatches = matches.filter((m) => m.is_losers_bracket)
    const gfMatches = matches.filter((m) => m.round === 200)
    const wbRounds = [...new Set(wbMatches.map((m) => m.round))].sort((a, b) => a - b)
    const wbMaxRound = wbRounds[wbRounds.length - 1]
    const lbRounds = [...new Set(lbMatches.map((m) => m.round))].sort((a, b) => a - b)
    const lbMaxRound = lbRounds[lbRounds.length - 1]

    const section = (title: string, key: string, label: (r: number) => string, rs: number[], pool: BracketMatch[]) => (
      <div key={key} className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {rs.map((round) => (
          <Card key={`${key}-${round}`} className="border-border/50 bg-card/80">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{label(round)}</p>
              {pool.filter((m) => m.round === round).sort((a, b) => a.match_number - b.match_number).map(renderMatch)}
            </CardContent>
          </Card>
        ))}
      </div>
    )

    return (
      <div className="space-y-4">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {section("Winners bracket", "wb", (r) => (r === wbMaxRound ? "Winners финал" : `Тойрог ${r}`), wbRounds, wbMatches)}
        {lbRounds.length > 0 && section("Losers bracket", "lb", (r) => (r === lbMaxRound ? "Losers финал" : `Losers ${r - 100}`), lbRounds, lbMatches)}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Их финал</p>
          <Card className="border-primary/40 bg-card/80">
            <CardContent className="p-4 space-y-2">{gfMatches.map(renderMatch)}</CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Single Elimination / Round Robin / Swiss ─────────────────────
  // Round-аар бүлэглэх (winners bracket)
  const rounds = [...new Set(matches.filter((m) => !m.is_losers_bracket).map((m) => m.round))].sort((a, b) => a - b)
  const maxRound = rounds[rounds.length - 1]

  // Хүснэгт (round_robin / swiss) — дууссан match-аас тооцно
  const standings = isElimination ? [] : computeStandings(Object.keys(entrants), matches)

  // Swiss: тойрог удирдлага (зохион байгуулагч, бүх match дууссан үед)
  const swissAllDone = bracketType === "swiss" && matches.length > 0 && matches.every((m) => m.status === "completed")

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {standings.length > 0 && (
        <StandingsTable rows={standings} nameOf={(id) => entrants[id]?.display_name ?? "?"} myEntrant={myEntrant} />
      )}
      {isOrganizer && bracketType === "swiss" && status === "ongoing" && swissAllDone && (
        <Card className="border-primary/40 bg-card/80">
          <CardContent className="flex flex-col items-center gap-2 py-5">
            <p className="text-sm text-muted-foreground">Тойрог дууслаа — үргэлжлүүлэх үү?</p>
            <div className="flex gap-2">
              <Button onClick={() => swissAction("next-round")} disabled={busy === "next-round"}>
                {busy === "next-round" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Дараагийн тойрог
              </Button>
              <Button variant="outline" onClick={() => swissAction("finish")} disabled={busy === "finish"}>
                {busy === "finish" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Тэмцээн дуусгах
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {rounds.map((round) => (
        <Card key={round} className="border-border/50 bg-card/80">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {isElimination && round === maxRound ? "Финал" : `Тойрог ${round}`}
            </p>
            {matches.filter((m) => !m.is_losers_bracket && m.round === round).sort((a, b) => a.match_number - b.match_number).map(renderMatch)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StandingsTable({
  rows,
  nameOf,
  myEntrant,
}: {
  rows: import("@/lib/tournament/standings").EntrantStanding[]
  nameOf: (id: string) => string
  myEntrant: string | undefined
}) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Хүснэгт</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground/70 border-b border-border/40">
                <th className="text-left font-medium py-1.5 pl-1 w-6">#</th>
                <th className="text-left font-medium py-1.5">Тоглогч</th>
                <th className="text-center font-medium py-1.5 w-8" title="Тоглосон">Т</th>
                <th className="text-center font-medium py-1.5 w-12" title="Хож-Хож">Х-Я</th>
                <th className="text-center font-medium py-1.5 w-12" title="Leg зөрүү">+/-</th>
                <th className="text-center font-medium py-1.5 w-8 pr-1" title="Оноо">О</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.entrantId}
                  className={cn(
                    "border-b border-border/20 last:border-0",
                    r.entrantId === myEntrant && "bg-primary/5",
                  )}
                >
                  <td className="py-1.5 pl-1 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="py-1.5 truncate font-medium">{nameOf(r.entrantId)}</td>
                  <td className="py-1.5 text-center tabular-nums text-muted-foreground">{r.played}</td>
                  <td className="py-1.5 text-center tabular-nums">{r.won}-{r.lost}</td>
                  <td className="py-1.5 text-center tabular-nums text-muted-foreground">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                  <td className="py-1.5 text-center tabular-nums font-bold pr-1">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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
