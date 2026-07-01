"use client"

import Link from "next/link"
import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Loader2, Swords, Tv2, Maximize2, Minimize2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { BracketMatch, BracketEntrant } from "@/hooks/useTournamentBracket"
import { computeStandings } from "@/lib/tournament/standings"
import type { TournamentStageInfo } from "@/app/(main)/tournaments/[id]/TournamentDetail"
import { STAGE_LABELS } from "@/lib/tournament/stage-types"
import { MatchLiveView } from "./MatchLiveView"

interface Props {
  tournamentId: string
  status: string
  isOrganizer: boolean
  currentUserId: string | null
  bracketType: string
  usesStages?: boolean
  stages?: TournamentStageInfo[]
  matches: BracketMatch[]
  entrants: Record<string, BracketEntrant>
  playerEntrant: Record<string, string>
  loading: boolean
}

export function BracketView({ tournamentId, status, isOrganizer, currentUserId, bracketType, usesStages = false, stages = [], matches, entrants, playerEntrant, loading }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null)
  const [showLive, setShowLive] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const liveContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === liveContainerRef.current)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      liveContainerRef.current?.requestFullscreen()
    }
  }, [])

  const myEntrant = currentUserId ? playerEntrant[currentUserId] : undefined
  const nameOf = (id: string | null) => (id ? entrants[id]?.display_name ?? "?" : null)

  async function startTournament() {
    setBusy("tournament"); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/start`, { method: "POST" })
      const j = await res.json()
      if (!res.ok) setError(j.error ?? "Алдаа гарлаа")
      else router.refresh()
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

  async function advanceStage() {
    setBusy("advance"); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/advance-stage`, { method: "POST" })
      const j = await res.json()
      if (!res.ok) setError(j.error ?? "Алдаа гарлаа")
      else router.refresh()
    } finally { setBusy(null) }
  }

  // Match дарахад popup нээнэ
  const handleMatchClick = useCallback((m: BracketMatch) => {
    setSelectedMatch(m)
    setShowLive(false)
    setError(null)
  }, [])

  // Popup-аас "Орох/Эхлүүлэх" дарахад API дуудаж navigate хийнэ
  const joinMatch = useCallback(async (m: BracketMatch) => {
    setBusy(m.id); setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/match/${m.id}/start`, { method: "POST" })
      const j = await res.json()
      if (res.ok && j.roomId) {
        setSelectedMatch(null)
        router.push(`/play/${j.roomId}`)
      } else {
        setError(j.error ?? "Тоглолт эхлүүлэхэд алдаа гарлаа")
      }
    } finally { setBusy(null) }
  }, [tournamentId, router])

  // ── Match action popup ───────────────────────────────────────────────────────
  const canJoinMatch = (m: BracketMatch) => {
    const isMine = !!(myEntrant && (m.side1_entrant_id === myEntrant || m.side2_entrant_id === myEntrant))
    return (isMine || isOrganizer) && m.status !== "completed" && !!m.side1_entrant_id && !!m.side2_entrant_id
  }

  const matchDialog = selectedMatch && (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        if (document.fullscreenElement) document.exitFullscreen()
        setSelectedMatch(null); setShowLive(false)
      }
    }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">
            {showLive ? "Live" : "Тоглолт"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {showLive && selectedMatch.room_id ? (
            <div
              ref={liveContainerRef}
              className={cn(
                "space-y-3",
                isFullscreen && "fixed inset-0 z-50 bg-background flex flex-col justify-center px-6 py-10 overflow-auto"
              )}
            >
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
              <MatchLiveView
                roomId={selectedMatch.room_id}
                side1EntrantId={selectedMatch.side1_entrant_id}
                side2EntrantId={selectedMatch.side2_entrant_id}
                entrants={entrants}
                large={isFullscreen}
              />
              {!isFullscreen && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowLive(false)}>
                  ← Буцах
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2.5">
                <span className="flex-1 text-sm font-medium truncate">{nameOf(selectedMatch.side1_entrant_id) ?? "Тодорхойгүй"}</span>
                <span className="text-[11px] font-bold text-muted-foreground shrink-0">VS</span>
                <span className="flex-1 text-sm font-medium truncate text-right">{nameOf(selectedMatch.side2_entrant_id) ?? "Тодорхойгүй"}</span>
              </div>

              {selectedMatch.status === "ongoing" && (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                  Тоглолт явагдаж байна
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                {canJoinMatch(selectedMatch) && (
                  <Button onClick={() => joinMatch(selectedMatch)} disabled={busy === selectedMatch.id} className="w-full">
                    {busy === selectedMatch.id
                      ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      : <Swords className="h-4 w-4 mr-1.5" />
                    }
                    {selectedMatch.status === "ongoing" ? "Тоглолт руу орох" : "Тоглолт эхлүүлэх"}
                  </Button>
                )}
                {selectedMatch.status === "ongoing" && selectedMatch.room_id && (
                  <Button variant="outline" className="w-full" onClick={() => setShowLive(true)}>
                    <Tv2 className="h-4 w-4 mr-1.5" />
                    Live харах
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => setSelectedMatch(null)}>
                  Хаах
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

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
    return (
      <Card className="border-border/50 bg-card/80">
        <CardContent className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // ── Multi-stage pipeline ─────────────────────────────────────────
  if (usesStages && stages.length > 0) {
    const activeStage = stages.find((s) => s.status === "active") ?? stages[0]
    const stageMatches = matches.filter((m) => m.stage_id === activeStage.id)
    const allStageDone = stageMatches.length > 0 && stageMatches.every((m) => m.status === "completed")
    const hasNextStage = stages.findIndex((s) => s.id === activeStage.id) < stages.length - 1

    return (
      <div className="space-y-4">
        {matchDialog}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Stage timeline */}
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border",
                s.status === "active" ? "bg-primary/15 text-primary border-primary/40" :
                s.status === "completed" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                "bg-muted/40 text-muted-foreground border-border/40"
              )}>
                {STAGE_LABELS[s.stage_type as keyof typeof STAGE_LABELS] ?? s.stage_type}
              </span>
              {i < stages.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Active stage content */}
        <div className="space-y-2">
          <SectionHeader title={STAGE_LABELS[activeStage.stage_type as keyof typeof STAGE_LABELS] ?? activeStage.stage_type} />
          {stageMatches.length === 0 ? (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="py-10 flex justify-center">
                <p className="text-sm text-muted-foreground/60">Тоглолтууд үүсгэгдэж байна...</p>
              </CardContent>
            </Card>
          ) : activeStage.stage_type === "group" ? (
            (() => {
              const groupNos = [...new Set(stageMatches.map((m) => m.group_no).filter((g): g is number => g != null))].sort((a, b) => a - b)
              return (
                <div className="space-y-4">
                  {groupNos.map((gno) => {
                    const groupEntrantIds = Object.values(entrants).filter((e) => e.group_no === gno).map((e) => e.id)
                    const gMatches = stageMatches.filter((m) => m.group_no === gno)
                    return (
                      <div key={gno} className="space-y-2">
                        <SectionHeader title={`Бүлэг ${String.fromCharCode(64 + gno)}`} />
                        <OnlineRRGrid
                          entrantIds={groupEntrantIds}
                          matches={gMatches}
                          entrants={entrants}
                          myEntrant={myEntrant}
                          isOrganizer={isOrganizer}
                          busy={busy}
                          onStartMatch={handleMatchClick}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })()
          ) : activeStage.stage_type === "round_robin" || activeStage.stage_type === "swiss" ? (
            (() => {
              const entrantIds = Object.keys(entrants)
              const standings = computeStandings(entrantIds, stageMatches)
              return (
                <OnlineRRGrid
                  entrantIds={entrantIds}
                  matches={stageMatches}
                  entrants={entrants}
                  myEntrant={myEntrant}
                  isOrganizer={isOrganizer}
                  busy={busy}
                  onStartMatch={handleMatchClick}
                  standings={standings}
                />
              )
            })()
          ) : (
            (() => {
              const hasLosers = stageMatches.some((m) => m.is_losers_bracket)
              if (hasLosers) {
                const wbMatches = stageMatches.filter((m) => !m.is_losers_bracket && m.round < 200)
                const lbMatches = stageMatches.filter((m) => m.is_losers_bracket)
                const gfMatches = stageMatches.filter((m) => m.round === 200)
                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <SectionHeader title="Winners bracket" />
                      <OnlineEliminationBracket matches={wbMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={Math.max(...wbMatches.map((m) => m.round))} />
                    </div>
                    {lbMatches.length > 0 && (
                      <div className="space-y-2">
                        <SectionHeader title="Losers bracket" />
                        <OnlineEliminationBracket matches={lbMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={Math.max(...lbMatches.map((m) => m.round))} />
                      </div>
                    )}
                    {gfMatches.length > 0 && (
                      <div className="space-y-2">
                        <SectionHeader title="Их финал" />
                        <OnlineEliminationBracket matches={gfMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={200} />
                      </div>
                    )}
                  </div>
                )
              }
              // SE / semifinal / final
              const thirdPlaceMatches = stageMatches.filter((m) => m.round === 998)
              const mainMatches = stageMatches.filter((m) => m.round !== 998)
              const maxRound = mainMatches.length ? Math.max(...mainMatches.map((m) => m.round)) : 1
              return (
                <div className="space-y-4">
                  <OnlineEliminationBracket matches={mainMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={maxRound} />
                  {thirdPlaceMatches.length > 0 && (
                    <div className="space-y-2">
                      <SectionHeader title="3-р байрны тоглолт" />
                      <OnlineEliminationBracket matches={thirdPlaceMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={998} />
                    </div>
                  )}
                </div>
              )
            })()
          )}
        </div>

        {/* Advance stage button */}
        {isOrganizer && allStageDone && hasNextStage && (
          <Card className="border-primary/40 bg-card/80">
            <CardContent className="flex flex-col items-center gap-2 py-5">
              <p className="text-sm text-muted-foreground">
                {STAGE_LABELS[activeStage.stage_type as keyof typeof STAGE_LABELS]} дууслаа
              </p>
              <Button onClick={advanceStage} disabled={busy === "advance"}>
                {busy === "advance" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Дараагийн шатанд шилжих
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const isElimination = bracketType === "single_elimination" || bracketType === "double_elimination"

  // ── Groups + Knockout ────────────────────────────────────────────
  if (bracketType === "groups_knockout") {
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
        {matchDialog}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {groupNos.map((gno) => {
          const groupEntrantIds = Object.values(entrants).filter((e) => e.group_no === gno).map((e) => e.id)
          const gMatches = groupMatches.filter((m) => m.group_no === gno)
          const gLabel = `Бүлэг ${String.fromCharCode(64 + gno)}`
          return (
            <div key={gno} className="space-y-2">
              <SectionHeader title={gLabel} />
              <OnlineRRGrid
                entrantIds={groupEntrantIds}
                matches={gMatches}
                entrants={entrants}
                myEntrant={myEntrant}
                isOrganizer={isOrganizer}
                busy={busy}
                onStartMatch={handleMatchClick}
              />
            </div>
          )
        })}

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

        {koSeeded && (
          <div className="space-y-2">
            <SectionHeader title="Шигшээ шат" />
            <OnlineEliminationBracket
              matches={koMatches}
              entrants={entrants}
              myEntrant={myEntrant}
              isOrganizer={isOrganizer}
              busy={busy}
              onStartMatch={handleMatchClick}
              maxRound={koMaxRound}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Double Elimination ───────────────────────────────────────────
  if (bracketType === "double_elimination") {
    const wbMatches = matches.filter((m) => !m.is_losers_bracket && m.round < 200)
    const lbMatches = matches.filter((m) => m.is_losers_bracket)
    const gfMatches = matches.filter((m) => m.round === 200)
    const wbMaxRound = wbMatches.length ? Math.max(...wbMatches.map((m) => m.round)) : 0
    const lbMaxRound = lbMatches.length ? Math.max(...lbMatches.map((m) => m.round)) : 0

    return (
      <div className="space-y-5">
        {matchDialog}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="space-y-2">
          <SectionHeader title="Winners bracket" />
          <OnlineEliminationBracket matches={wbMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={wbMaxRound} />
        </div>
        {lbMatches.length > 0 && (
          <div className="space-y-2">
            <SectionHeader title="Losers bracket" />
            <OnlineEliminationBracket matches={lbMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={lbMaxRound} />
          </div>
        )}
        <div className="space-y-2">
          <SectionHeader title="Их финал" />
          <OnlineEliminationBracket matches={gfMatches} entrants={entrants} myEntrant={myEntrant} isOrganizer={isOrganizer} busy={busy} onStartMatch={handleMatchClick} maxRound={200} />
        </div>
      </div>
    )
  }

  // ── Single Elimination ───────────────────────────────────────────
  if (bracketType === "single_elimination") {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
    const maxRound = rounds[rounds.length - 1]
    return (
      <div className="space-y-2">
        {matchDialog}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <OnlineEliminationBracket
          matches={matches}
          entrants={entrants}
          myEntrant={myEntrant}
          isOrganizer={isOrganizer}
          busy={busy}
          onStartMatch={handleMatchClick}
          maxRound={maxRound}
        />
      </div>
    )
  }

  // ── Round Robin / Swiss ──────────────────────────────────────────
  const entrantIds = Object.keys(entrants)
  const standings = computeStandings(entrantIds, matches)
  const swissAllDone = bracketType === "swiss" && matches.length > 0 && matches.every((m) => m.status === "completed")

  return (
    <div className="space-y-4">
      {matchDialog}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <OnlineRRGrid
        entrantIds={entrantIds}
        matches={matches}
        entrants={entrants}
        myEntrant={myEntrant}
        isOrganizer={isOrganizer}
        busy={busy}
        onStartMatch={handleMatchClick}
        standings={standings}
      />
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
    </div>
  )
}

// ── Round Robin Cross-Table ───────────────────────────────────────────────────

interface RRGridProps {
  entrantIds: string[]
  matches: BracketMatch[]
  entrants: Record<string, BracketEntrant>
  myEntrant: string | undefined
  isOrganizer: boolean
  busy: string | null
  onStartMatch: (m: BracketMatch) => void
  standings?: import("@/lib/tournament/standings").EntrantStanding[]
}

function OnlineRRGrid({ entrantIds, matches, entrants, myEntrant, isOrganizer, busy, onStartMatch, standings: externalStandings }: RRGridProps) {
  const computedStandings = externalStandings ?? computeStandings(entrantIds, matches)

  const lookup: Record<string, BracketMatch> = {}
  const matchNumber: Record<string, number> = {}
  let num = 1
  matches.forEach((m) => {
    if (m.side1_entrant_id && m.side2_entrant_id) {
      lookup[`${m.side1_entrant_id}_${m.side2_entrant_id}`] = m
      lookup[`${m.side2_entrant_id}_${m.side1_entrant_id}`] = m
      matchNumber[m.id] = num++
    }
  })

  const sorted = computedStandings.map((s) => s.entrantId).filter((id) => entrantIds.includes(id))

  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/80">
      <table className="border-collapse w-full text-sm">
        <thead>
          <tr className="bg-secondary/60">
            <th className="px-2 py-2 text-left text-[11px] text-muted-foreground font-medium w-6 sticky left-0 z-20 bg-secondary/80">#</th>
            <th className="px-3 py-2 text-left text-[11px] text-muted-foreground font-medium min-w-[100px] sticky left-6 z-20 bg-secondary/80 border-r border-border/40">Нэр</th>
            {sorted.map((_, i) => (
              <th key={i} className="py-2 text-center text-[11px] text-muted-foreground font-medium w-16 min-w-[64px]">{i + 1}</th>
            ))}
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-14">Х-Я</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-14">Legs</th>
            <th className="px-2 py-2 text-center text-[11px] text-muted-foreground font-medium w-8">О</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pid, rowIdx) => {
            const st = computedStandings.find((s) => s.entrantId === pid)
            const isMe = pid === myEntrant
            return (
              <tr key={pid} className={cn(
                "border-t border-border/25 hover:bg-secondary/10 transition-colors group",
                isMe && "bg-primary/5"
              )}>
                <td className="px-2 py-2 text-xs text-muted-foreground text-center sticky left-0 z-10 bg-card group-hover:bg-secondary/20 transition-colors">{rowIdx + 1}</td>
                <td className="px-3 py-2 font-medium text-sm truncate max-w-[130px] sticky left-6 z-10 bg-card group-hover:bg-secondary/20 transition-colors border-r border-border/40">
                  {entrants[pid]?.display_name ?? "?"}
                </td>
                {sorted.map((cpid) => {
                  if (pid === cpid) return <td key={cpid} className="bg-secondary/40" />
                  const m = lookup[`${pid}_${cpid}`]
                  if (!m) return <td key={cpid} />

                  const isP1 = m.side1_entrant_id === pid
                  const myLegs  = isP1 ? m.side1_legs : m.side2_legs
                  const oppLegs = isP1 ? m.side2_legs : m.side1_legs
                  const iWon  = m.status === "completed" && m.winner_entrant_id === pid
                  const iLost = m.status === "completed" && m.winner_entrant_id !== null && m.winner_entrant_id !== pid
                  const isLive = m.status === "ongoing"
                  const canAct = (isMe || isOrganizer) && m.status === "pending" && !!m.side1_entrant_id && !!m.side2_entrant_id

                  const scoreCell = (
                    <div className={cn(
                      "flex items-center justify-center rounded text-[11px] font-bold px-1.5 py-1 mx-1 min-h-[36px] transition-all",
                      iWon  ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
                      iLost ? "bg-destructive/10 text-destructive/80 hover:bg-destructive/15" :
                      "text-muted-foreground hover:bg-secondary/40"
                    )}>
                      <span className="score-display text-sm whitespace-nowrap">{myLegs} - {oppLegs}</span>
                    </div>
                  )

                  return (
                    <td key={cpid} className="py-1 text-center min-w-[64px]">
                      {m.status === "completed" ? (
                        m.room_id
                          ? <Link href={`/play/${m.room_id}`}>{scoreCell}</Link>
                          : scoreCell
                      ) : isLive ? (
                        <button onClick={() => onStartMatch(m)}
                          className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 border-2 border-primary pulse-live mx-auto">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        </button>
                      ) : canAct ? (
                        <button onClick={() => onStartMatch(m)} disabled={busy === m.id}
                          className="flex items-center justify-center w-9 h-9 rounded-full border border-primary/50 text-[11px] text-primary hover:bg-primary/10 mx-auto transition-all">
                          {busy === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : matchNumber[m.id] ?? "?"}
                        </button>
                      ) : (
                        <div className="flex items-center justify-center w-9 h-9 rounded-full border border-border/50 text-[11px] text-muted-foreground mx-auto">
                          {matchNumber[m.id] ?? "?"}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-semibold whitespace-nowrap">
                  {st ? (
                    <><span className="text-green-400">{st.won}</span>
                    <span className="text-muted-foreground"> - </span>
                    <span className="text-destructive/80">{st.lost}</span></>
                  ) : ""}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground score-display whitespace-nowrap">
                  {st ? `${st.legsWon} - ${st.legsLost}` : ""}
                </td>
                <td className="px-2 py-2 text-center text-sm font-bold text-primary">
                  {st ? st.points : ""}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Elimination Bracket ───────────────────────────────────────────────────────

interface EliminationProps {
  matches: BracketMatch[]
  entrants: Record<string, BracketEntrant>
  myEntrant: string | undefined
  isOrganizer: boolean
  busy: string | null
  onStartMatch: (m: BracketMatch) => void
  maxRound: number
}

function OnlineEliminationBracket({ matches, entrants, myEntrant, isOrganizer, busy, onStartMatch, maxRound }: EliminationProps) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const totalRounds = rounds.length

  function getRoundLabel(idx: number) {
    const fromEnd = totalRounds - 1 - idx
    if (fromEnd === 0) return "Финал"
    if (fromEnd === 1) return "Хагас финал"
    if (fromEnd === 2) return "Улирал финал"
    const n = Math.pow(2, fromEnd + 1)
    return `Round of ${Number.isFinite(n) && n < 1e9 ? n : idx + 1}`
  }

  const matchH = 72

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-0 min-w-max">
        {rounds.map((round, roundIdx) => {
          const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.match_number - b.match_number)
          const isLast = roundIdx === rounds.length - 1
          const prevCount = roundIdx > 0
            ? matches.filter((m) => m.round === rounds[roundIdx - 1]).length
            : roundMatches.length * 2
          const gap = roundIdx === 0 ? 8 : (prevCount / roundMatches.length - 1) * matchH + 8

          return (
            <div key={round} className="flex">
              <div className="flex flex-col" style={{ minWidth: 170 }}>
                <div className="text-center pb-2 px-2">
                  <p className="text-xs font-semibold text-foreground/80">{getRoundLabel(roundIdx)}</p>
                </div>
                <div className="flex flex-col" style={{ gap }}>
                  {roundMatches.map((m) => (
                    <OnlineMatchSlot
                      key={m.id}
                      match={m}
                      entrants={entrants}
                      myEntrant={myEntrant}
                      isOrganizer={isOrganizer}
                      busy={busy}
                      onStartMatch={onStartMatch}
                    />
                  ))}
                </div>
              </div>
              {!isLast && (
                <BracketConnector
                  matchCount={roundMatches.length}
                  matchHeight={matchH}
                  gap={gap}
                  nextGap={roundIdx + 1 < rounds.length - 1
                    ? (roundMatches.length / matches.filter((m) => m.round === rounds[roundIdx + 1]).length - 1) * matchH + 8
                    : gap}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Match Slot ────────────────────────────────────────────────────────────────

function OnlineMatchSlot({ match: m, entrants, myEntrant, isOrganizer, busy, onStartMatch }: {
  match: BracketMatch
  entrants: Record<string, BracketEntrant>
  myEntrant: string | undefined
  isOrganizer: boolean
  busy: string | null
  onStartMatch: (m: BracketMatch) => void
}) {
  const name = (id: string | null) => id ? (entrants[id]?.display_name ?? "?") : null
  const isDone = m.status === "completed"
  const isLive = m.status === "ongoing"
  const isTBD  = !m.side1_entrant_id || !m.side2_entrant_id
  const mine   = myEntrant && (m.side1_entrant_id === myEntrant || m.side2_entrant_id === myEntrant)
  const canAct = (mine || isOrganizer) && !isDone && !!m.side1_entrant_id && !!m.side2_entrant_id

  const sides = [
    { id: m.side1_entrant_id, legs: m.side1_legs },
    { id: m.side2_entrant_id, legs: m.side2_legs },
  ]

  const card = (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden transition-all",
      isLive ? "border-primary shadow-md shadow-primary/20" :
      isDone ? "border-green-500/30" :
      isTBD  ? "border-border/30 opacity-60" :
      "border-border/50 hover:border-primary/40"
    )}>
      {sides.map((p, side) => (
        <div key={side}>
          {side === 1 && <div className="h-px bg-border/40" />}
          <div className={cn(
            "flex items-center justify-between gap-2 px-2.5 bg-card h-7",
            isDone && m.winner_entrant_id === p.id ? "bg-green-500/10" : "",
            isDone && m.winner_entrant_id !== null && m.winner_entrant_id !== p.id ? "opacity-50" : "",
          )}>
            <span className={cn(
              "truncate font-medium text-xs",
              isDone && m.winner_entrant_id === p.id ? "text-green-400" : "",
              !p.id ? "text-muted-foreground/50 italic" : ""
            )}>
              {name(p.id) ?? "Тодорхойгүй"}
            </span>
            {(isLive || isDone) && p.id && (
              <span className={cn(
                "font-bold score-display shrink-0 text-xs",
                isDone && m.winner_entrant_id === p.id ? "text-green-400" : "text-muted-foreground"
              )}>
                {p.legs}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // Live match: spectators can also navigate to the room to watch
  const canOpen = canAct || isLive
  if (!canOpen || isTBD) return card

  return (
    <button onClick={() => onStartMatch(m)} disabled={busy === m.id} className="block w-full text-left">
      {busy === m.id ? (
        <div className="flex items-center justify-center h-[58px] border-2 border-primary/40 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : card}
    </button>
  )
}

// ── Bracket Connector Lines ───────────────────────────────────────────────────

function BracketConnector({ matchCount, matchHeight, gap, nextGap }: {
  matchCount: number; matchHeight: number; gap: number; nextGap: number
}) {
  const pairs = matchCount / 2
  const pairHeight = matchHeight * 2 + gap
  return (
    <div className="flex flex-col relative" style={{ width: 24 }}>
      {Array.from({ length: pairs }).map((_, i) => (
        <div key={i} className="relative" style={{ height: pairHeight, marginBottom: i < pairs - 1 ? nextGap : 0 }}>
          <div className="absolute right-0 bg-border/60" style={{ width: 2, top: matchHeight / 2, height: (pairHeight - matchHeight) / 2 }} />
          <div className="absolute right-0 bg-border/60" style={{ width: 2, top: pairHeight / 2, height: (pairHeight - matchHeight) / 2 }} />
          <div className="absolute bg-border/60" style={{ height: 2, right: 0, left: 0, top: pairHeight / 2 - 1 }} />
        </div>
      ))}
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}
