"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, Delete, Trophy, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCheckout, classifyTurn } from "@/lib/local-game/checkouts"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DartThrow {
  score: number     // points scored (0-60)
  label: string     // e.g. "T20", "S5", "DBull", "Miss"
  bust?: boolean
}

export interface DartVisit {
  darts: [DartThrow | null, DartThrow | null, DartThrow | null]
  total: number
  bust: boolean
}

interface PlayerState {
  name: string
  remaining: number
  legs: number
  visits: DartVisit[]
}

interface Props {
  player1Name: string
  player2Name: string
  startScore?: number
  legsToWin?: number
  doubleOut?: boolean
  onWinner?: (player: 1 | 2) => void
  onBack?: () => void
}

// ── Common dart segments (quick pick) ────────────────────────────────────────

const QUICK_DARTS: { label: string; score: number }[] = [
  { label: "T20", score: 60 }, { label: "T19", score: 57 }, { label: "T18", score: 54 },
  { label: "T17", score: 51 }, { label: "T16", score: 48 }, { label: "T15", score: 45 },
  { label: "D20", score: 40 }, { label: "D18", score: 36 }, { label: "D16", score: 32 },
  { label: "D10", score: 20 }, { label: "D8",  score: 16 }, { label: "D6",  score: 12 },
  { label: "D4",  score:  8 }, { label: "D3",  score:  6 }, { label: "D2",  score:  4 },
  { label: "D1",  score:  2 }, { label: "DBull", score: 50 }, { label: "SBull", score: 25 },
  { label: "S20", score: 20 }, { label: "S19", score: 19 }, { label: "S18", score: 18 },
  { label: "S10", score: 10 }, { label: "S5",  score:  5 }, { label: "S1",  score:  1 },
  { label: "Miss", score: 0 },
]

// Derive label from score (best-guess for numeric input)
function guessLabel(score: number): string {
  if (score === 0) return "Miss"
  if (score === 50) return "DBull"
  if (score === 25) return "SBull"
  if (score % 3 === 0 && score / 3 <= 20) return `T${score / 3}`
  if (score % 2 === 0 && score / 2 <= 20) return `D${score / 2}`
  if (score <= 20) return `S${score}`
  return `${score}`
}

// ── Sub: DartBox ─────────────────────────────────────────────────────────────

function DartBox({ dart, active }: { dart: DartThrow | null; active?: boolean }) {
  if (!dart) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center rounded-xl h-16 w-[4.5rem] border-2 transition-all",
        active
          ? "border-primary/60 bg-primary/5 animate-pulse"
          : "border-border/30 bg-secondary/20"
      )}>
        <span className="text-lg font-black text-muted-foreground/30">—</span>
      </div>
    )
  }
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl h-16 w-[4.5rem] border-2 transition-all",
      dart.bust
        ? "border-destructive/40 bg-destructive/10"
        : dart.score === 0
        ? "border-border/30 bg-secondary/30"
        : "border-primary/40 bg-primary/10"
    )}>
      <span className={cn(
        "text-2xl font-black score-display leading-none",
        dart.bust ? "text-destructive/60" : dart.score === 0 ? "text-muted-foreground/40" : "text-foreground"
      )}>
        {dart.score}
      </span>
      <span className={cn(
        "text-[10px] font-semibold mt-0.5 tracking-tight",
        dart.bust ? "text-destructive/50" : "text-muted-foreground"
      )}>
        {dart.label}
      </span>
    </div>
  )
}

// ── Sub: PlayerPanel ──────────────────────────────────────────────────────────

function PlayerPanel({
  player,
  active,
  legsToWin,
  currentDarts,
  colorClass,
}: {
  player: PlayerState
  active: boolean
  legsToWin: number
  currentDarts: [DartThrow | null, DartThrow | null, DartThrow | null]
  colorClass: string
}) {
  const lastVisit = player.visits[player.visits.length - 1]
  const dartsToShow: [DartThrow | null, DartThrow | null, DartThrow | null] = active
    ? currentDarts
    : lastVisit?.darts ?? [null, null, null]

  const avg3 = player.visits.length
    ? Math.round(
        (player.visits.reduce((a, v) => a + (v.bust ? 0 : v.total), 0) /
          player.visits.length)
      )
    : 0

  return (
    <div className={cn(
      "flex flex-col min-w-0 transition-all rounded-xl overflow-hidden border",
      active ? `${colorClass} border-current/40` : "border-border/30 bg-secondary/10 opacity-70"
    )}>
      {/* Name + legs */}
      <div className={cn("px-3 py-2 text-center", active ? "bg-current/10" : "bg-secondary/30")}>
        <p className={cn("text-sm font-extrabold truncate", active ? "text-current" : "text-muted-foreground")}>
          {player.name}
        </p>
        <div className="flex justify-center gap-1 mt-1">
          {Array.from({ length: legsToWin }).map((_, i) => (
            <div key={i} className={cn("h-1 rounded-full transition-all",
              i < player.legs
                ? `bg-current w-3.5 ${active ? "" : "opacity-50"}`
                : "bg-current/20 w-2"
            )} />
          ))}
        </div>
      </div>

      {/* Remaining score */}
      <div className="flex items-end justify-center gap-2 px-3 py-3 bg-card">
        <span className={cn(
          "text-5xl font-black score-display leading-none tabular-nums",
          active ? "text-foreground" : "text-foreground/45"
        )}>
          {player.remaining}
        </span>
        <span className={cn("text-xs font-mono mb-1", active ? "text-muted-foreground" : "text-muted-foreground/40")}>
          avg {avg3}
        </span>
      </div>

      {/* Dart boxes */}
      <div className="flex gap-1.5 justify-center px-2 pb-3">
        {dartsToShow.map((d, i) => (
          <DartBox key={i} dart={d} active={active && d === null && dartsToShow.slice(0, i).every(Boolean)} />
        ))}
      </div>

      {/* Recent visit history */}
      <div className="border-t border-border/30 px-2 py-2 space-y-0.5 max-h-28 overflow-y-auto">
        {[...player.visits].reverse().slice(0, 6).map((v, i) => (
          <div key={i} className="flex items-center gap-1 justify-between text-[10px]">
            <div className="flex gap-1">
              {v.darts.map((d, j) => (
                <span key={j} className={cn(
                  "font-mono px-1 rounded",
                  d === null ? "text-muted-foreground/20" :
                  d.bust ? "text-destructive/50 line-through" :
                  d.score >= 50 ? "text-yellow-400" :
                  d.score >= 40 ? "text-primary" :
                  "text-muted-foreground"
                )}>
                  {d?.label ?? "—"}
                </span>
              ))}
            </div>
            <span className={cn("font-black tabular-nums",
              v.bust ? "text-destructive/50 line-through" :
              v.total >= 100 ? "text-yellow-400" :
              v.total >= 40 ? "text-primary/80" :
              "text-muted-foreground/70"
            )}>
              {v.bust ? "Bust" : v.total}
            </span>
          </div>
        ))}
        {player.visits.length === 0 && (
          <p className="text-[10px] text-muted-foreground/30 text-center py-1">—</p>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PerDartScoreboard({
  player1Name,
  player2Name,
  startScore = 501,
  legsToWin = 3,
  doubleOut = true,
  onWinner,
  onBack,
}: Props) {
  const [players, setPlayers] = useState<[PlayerState, PlayerState]>([
    { name: player1Name, remaining: startScore, legs: 0, visits: [] },
    { name: player2Name, remaining: startScore, legs: 0, visits: [] },
  ])
  const [active, setActive] = useState<0 | 1>(0)
  const [currentDarts, setCurrentDarts] = useState<[DartThrow | null, DartThrow | null, DartThrow | null]>([null, null, null])
  const [numInput, setNumInput] = useState("")
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const numRef = useRef<HTMLInputElement>(null)

  const filledCount = currentDarts.filter(Boolean).length
  const activePlayer = players[active]
  const remaining = activePlayer.remaining

  // Determine if turn is over (3 darts thrown or bust)
  const turnDone = filledCount === 3 || (
    currentDarts.some((d) => d?.bust)
  )

  // Outcome of last dart entered
  const lastDart = currentDarts[filledCount - 1]
  const visitTotal = currentDarts.reduce((a, d) => a + (d?.score ?? 0), 0)
  const isBust = lastDart?.bust

  // After turn is done — turn summary
  const checkoutHint = !turnDone ? getCheckout(remaining - visitTotal > 0 ? remaining - visitTotal : remaining) : null

  function addDart(score: number, label: string) {
    if (turnDone) return
    const idx = filledCount
    const newRemaining = remaining - visitTotal - score

    let bust = false
    const outcome = classifyTurn(remaining - visitTotal, score, { doubleOut, requireBullFinish: false })
    if (outcome.type === "bust") bust = true

    const dart: DartThrow = { score, label, bust }
    const next: [DartThrow | null, DartThrow | null, DartThrow | null] = [...currentDarts] as [DartThrow | null, DartThrow | null, DartThrow | null]
    next[idx] = dart
    setCurrentDarts(next)
    setNumInput("")

    // If checkout — handle win
    if (outcome.type === "checkout") {
      finishTurn(next, true)
    }
  }

  function finishTurn(
    darts: [DartThrow | null, DartThrow | null, DartThrow | null] = currentDarts,
    checkout = false
  ) {
    const total = darts.reduce((a, d) => a + (d?.score ?? 0), 0)
    const bust = darts.some((d) => d?.bust)
    const scored = bust ? 0 : total

    const visit: DartVisit = { darts, total, bust }
    setPlayers((prev) => {
      const next: [PlayerState, PlayerState] = [{ ...prev[0] }, { ...prev[1] }]
      next[active] = {
        ...prev[active],
        remaining: prev[active].remaining - scored,
        visits: [...prev[active].visits, visit],
      }
      if (checkout) {
        next[active].legs = prev[active].legs + 1
        if (next[active].legs >= legsToWin) {
          setWinner((active + 1) as 1 | 2)
          onWinner?.((active + 1) as 1 | 2)
        } else {
          next[0].remaining = startScore
          next[1].remaining = startScore
        }
      }
      return next
    })
    setCurrentDarts([null, null, null])
    setActive((p) => (p === 0 ? 1 : 0))
    setTimeout(() => numRef.current?.focus(), 50)
  }

  function handleNumInput() {
    const score = parseInt(numInput)
    if (isNaN(score) || score < 0 || score > 60) { setNumInput(""); return }
    addDart(score, guessLabel(score))
  }

  function undoLastDart() {
    const idx = filledCount - 1
    if (idx < 0) return
    const next: [DartThrow | null, DartThrow | null, DartThrow | null] = [...currentDarts] as [DartThrow | null, DartThrow | null, DartThrow | null]
    next[idx] = null
    setCurrentDarts(next)
  }

  // After bust: auto-advance turn
  useEffect(() => {
    if (isBust && turnDone) {
      const t = setTimeout(() => finishTurn(), 800)
      return () => clearTimeout(t)
    }
  }, [isBust, turnDone])

  if (winner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-black">{players[winner - 1].name}</h2>
        <p className="text-muted-foreground">тэмцэнд ялав!</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm glow-primary"
        >
          Буцах
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 pt-2">
        {onBack && (
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <p className="flex-1 text-center text-xs text-muted-foreground">
          {startScore} · First to {legsToWin} legs{doubleOut ? " · Захаар гарах" : ""}
        </p>
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
      </div>

      {/* ── Two player panels ── */}
      <div className="grid grid-cols-2 gap-2">
        <PlayerPanel
          player={players[0]}
          active={active === 0}
          legsToWin={legsToWin}
          currentDarts={active === 0 ? currentDarts : [null, null, null]}
          colorClass="text-primary"
        />
        <PlayerPanel
          player={players[1]}
          active={active === 1}
          legsToWin={legsToWin}
          currentDarts={active === 1 ? currentDarts : [null, null, null]}
          colorClass="text-blue-400"
        />
      </div>

      {/* Turn status */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground">
          ▶ {activePlayer.name}
        </span>
        <div className="flex items-center gap-2">
          {isBust && (
            <span className="text-xs font-bold text-destructive animate-pulse">BUST</span>
          )}
          {filledCount > 0 && !isBust && !turnDone && (
            <span className="text-xs text-muted-foreground">
              Visit: <span className="font-bold text-foreground">{visitTotal}</span>
              {" "}→ <span className="text-primary font-bold">{remaining - visitTotal}</span>
            </span>
          )}
          {checkoutHint && (
            <span className="text-[11px] font-mono text-yellow-400">🎯 {checkoutHint}</span>
          )}
        </div>
      </div>

      {/* ── Quick dart picker ── */}
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">
          Dart {filledCount + 1} / 3
        </p>

        {/* Quick buttons grid */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DARTS.map(({ label, score }) => {
            // Highlight likely checkout darts
            const couldCheckout = remaining - visitTotal === score
            return (
              <button
                key={label}
                onClick={() => addDart(score, label)}
                disabled={turnDone}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                  couldCheckout
                    ? "border-green-500/50 bg-green-500/15 text-green-400 glow-sm"
                    : score >= 50
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                    : score >= 40
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : score === 0
                    ? "border-border/30 bg-secondary/30 text-muted-foreground/50"
                    : "border-border/40 bg-secondary/30 text-foreground/80 hover:border-border hover:bg-secondary/60"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Manual numeric input */}
        <div className="flex gap-2">
          <input
            ref={numRef}
            type="number"
            min={0}
            max={60}
            value={numInput}
            onChange={(e) => setNumInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleNumInput() }}
            placeholder="Оноо оруулах (0-60)"
            disabled={turnDone}
            className="flex-1 h-9 rounded-lg border border-border/60 bg-secondary/40 px-3 text-sm text-center font-mono focus:outline-none focus:border-primary/60 disabled:opacity-40"
          />
          <button
            onClick={handleNumInput}
            disabled={!numInput || turnDone}
            className="px-3 h-9 rounded-lg bg-secondary/60 border border-border/40 text-sm font-bold hover:bg-secondary disabled:opacity-40"
          >
            OK
          </button>
          <button
            onClick={undoLastDart}
            disabled={filledCount === 0}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/40 bg-secondary/40 hover:bg-secondary disabled:opacity-30"
            title="Сүүлчийн dart undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Next button */}
      {turnDone && !isBust && (
        <button
          onClick={() => finishTurn()}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm glow-primary hover:bg-primary/90 transition-all"
        >
          Дараагийн тоглогч →
        </button>
      )}
    </div>
  )
}
