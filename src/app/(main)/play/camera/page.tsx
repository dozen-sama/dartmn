"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, ChevronLeft, Loader2, RotateCcw, Scan, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CameraSetup } from "@/components/play/CameraSetup"
import {
  detectDartInFrames,
  loadCalibration,
  positionToScore,
  type BoardCalibration,
  type DartScore,
} from "@/lib/dartboard"
import { classifyTurn, getCheckout } from "@/lib/local-game/checkouts"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DartEntry {
  score: DartScore
  bust: boolean
}

interface PlayerState {
  name: string
  remaining: number
  legs: number
  visits: { darts: (DartEntry | null)[]; total: number; bust: boolean }[]
}

// ── DartBox ───────────────────────────────────────────────────────────────────

function DartBox({ entry, active }: { entry: DartEntry | null; active?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border-2 transition-all",
      "h-14 w-[4rem]",
      entry
        ? entry.bust
          ? "border-destructive/40 bg-destructive/10"
          : entry.score.score === 0
          ? "border-border/30 bg-secondary/30"
          : "border-primary/50 bg-primary/10"
        : active
        ? "border-primary/60 bg-primary/5 animate-pulse"
        : "border-border/20 bg-secondary/10",
    )}>
      {entry ? (
        <>
          <span className={cn(
            "text-xl font-black score-display leading-none",
            entry.bust ? "text-destructive/60 line-through" : "text-foreground",
          )}>
            {entry.score.score}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground mt-0.5">
            {entry.bust ? "Bust" : entry.score.label}
          </span>
        </>
      ) : (
        <span className="text-lg font-black text-muted-foreground/20">—</span>
      )}
    </div>
  )
}

// ── Main game ─────────────────────────────────────────────────────────────────

function CameraGame() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const refFrameRef = useRef<ImageData | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cal = useRef<BoardCalibration>(loadCalibration())

  const [phase, setPhase] = useState<"setup" | "game">("setup")
  const [players, setPlayers] = useState<[PlayerState, PlayerState]>([
    { name: "Тоглогч 1", remaining: 501, legs: 0, visits: [] },
    { name: "Тоглогч 2", remaining: 501, legs: 0, visits: [] },
  ])
  const [active, setActive] = useState<0 | 1>(0)
  const [darts, setDarts] = useState<(DartEntry | null)[]>([null, null, null])
  const [detecting, setDetecting] = useState(false)
  const [pendingScore, setPendingScore] = useState<DartScore | null>(null)
  const [tapMode, setTapMode] = useState(false) // fallback: tap on video
  const [winner, setWinner] = useState<0 | 1 | null>(null)

  const filledCount = darts.filter(Boolean).length
  const activePlayer = players[active]
  const visitTotal = darts.reduce((a, d) => a + (d && !d.bust ? d.score.score : 0), 0)
  const turnDone = filledCount === 3 || darts.some((d) => d?.bust)
  const checkoutHint = !turnDone && activePlayer.remaining - visitTotal > 1
    ? getCheckout(activePlayer.remaining - visitTotal)
    : null

  // Start camera
  useEffect(() => {
    if (phase !== "game") return
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {})
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [phase])

  // Draw overlay (dartboard circle + dart markers)
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.clientWidth
    canvas.height = video.clientHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { cx_pct, cy_pct, r_pct } = cal.current
    const cx = cx_pct * canvas.width
    const cy = cy_pct * canvas.height
    const r = r_pct * canvas.width

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])

    // Bull
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.094, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255,255,255,0.15)"
    ctx.lineWidth = 1
    ctx.stroke()

    // Dart markers
    darts.forEach((d, i) => {
      if (!d || !d.score) return
      // We don't have pixel positions stored, so just skip visual markers for now
    })
  }, [darts])

  useEffect(() => {
    drawOverlay()
  }, [drawOverlay, phase])

  // Capture reference frame (no darts yet)
  function captureReference() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0)
    refFrameRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  // Auto-detect dart from frame diff
  async function detectDart() {
    if (turnDone) return
    setDetecting(true)
    setPendingScore(null)
    setTapMode(false)

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) { setDetecting(false); return }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0)
    const curFrame = ctx.getImageData(0, 0, canvas.width, canvas.height)

    if (!refFrameRef.current) {
      // No reference yet — use current as reference, ask user to tap
      refFrameRef.current = curFrame
      setDetecting(false)
      setTapMode(true)
      return
    }

    // Frame diff
    const detected = detectDartInFrames(refFrameRef.current, curFrame)
    if (!detected) {
      setDetecting(false)
      setTapMode(true) // fallback to tap
      return
    }

    // Map pixel to board position
    const { cx_pct, cy_pct, r_pct } = cal.current
    const cx = cx_pct * canvas.width
    const cy = cy_pct * canvas.height
    const boardRadius = r_pct * canvas.width

    const dx = detected.px - cx
    const dy = detected.py - cy
    const dartScore = positionToScore(dx, dy, boardRadius)

    // Update reference for next dart
    refFrameRef.current = curFrame

    setDetecting(false)
    setPendingScore(dartScore)
  }

  // Handle tap on video (fallback)
  function handleVideoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!tapMode) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const tapX = e.clientX - rect.left
    const tapY = e.clientY - rect.top
    const { cx_pct, cy_pct, r_pct } = cal.current
    const cx = cx_pct * rect.width
    const cy = cy_pct * rect.height
    const boardRadius = r_pct * rect.width
    const dx = tapX - cx
    const dy = tapY - cy
    const dartScore = positionToScore(dx, dy, boardRadius)
    setTapMode(false)
    setPendingScore(dartScore)
  }

  // Confirm the pending score
  function confirmScore() {
    if (!pendingScore) return
    const idx = filledCount
    const remaining = activePlayer.remaining - visitTotal
    const outcome = classifyTurn(remaining, pendingScore.score, { doubleOut: true, requireBullFinish: false })
    const bust = outcome.type === "bust"

    const entry: DartEntry = { score: pendingScore, bust }
    const newDarts = [...darts] as (DartEntry | null)[]
    newDarts[idx] = entry
    setDarts(newDarts)
    setPendingScore(null)

    if (outcome.type === "checkout") {
      finishTurn(newDarts, true)
    } else if (bust) {
      setTimeout(() => finishTurn(newDarts, false), 700)
    }
    // Capture fresh reference after dart is confirmed
    setTimeout(captureReference, 300)
  }

  function finishTurn(finalDarts: (DartEntry | null)[], checkout: boolean) {
    const total = finalDarts.reduce((a, d) => a + (d && !d.bust ? d.score.score : 0), 0)
    const bust = finalDarts.some((d) => d?.bust)
    const scored = bust ? 0 : total
    const visit = { darts: finalDarts, total, bust }

    setPlayers((prev) => {
      const next: [PlayerState, PlayerState] = [{ ...prev[0] }, { ...prev[1] }]
      next[active] = {
        ...prev[active],
        remaining: prev[active].remaining - scored,
        visits: [...prev[active].visits, visit],
      }
      if (checkout) {
        next[active].legs = prev[active].legs + 1
        if (next[active].legs >= 3) {
          setWinner(active)
          return next
        }
        next[0].remaining = 501
        next[1].remaining = 501
      }
      return next
    })

    setDarts([null, null, null])
    setActive((p) => (p === 0 ? 1 : 0))
    // Reset reference for next player's turn
    setTimeout(captureReference, 500)
  }

  // Setup phase
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <CameraSetup
          onConfirmed={() => { cal.current = loadCalibration(); setPhase("game") }}
          onBack={() => router.back()}
        />
      </div>
    )
  }

  if (winner !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-black">{players[winner].name}</h2>
        <p className="text-muted-foreground">ялав!</p>
        <button onClick={() => router.back()}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          Буцах
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border/30">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-4">
          {([0, 1] as const).map((i) => (
            <div key={i} className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-lg transition-colors",
              active === i ? "bg-primary/15" : "opacity-50"
            )}>
              <span className={cn("text-sm font-bold", active === i ? "text-primary" : "text-foreground")}>
                {players[i].name}
              </span>
              <span className={cn("text-xl font-black score-display", active === i ? "text-foreground" : "text-muted-foreground")}>
                {players[i].remaining}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      </div>

      {/* ── Camera feed ── */}
      <div
        className={cn(
          "relative flex-1 bg-black overflow-hidden cursor-crosshair",
          tapMode && "ring-2 ring-yellow-400 ring-inset"
        )}
        onClick={handleVideoTap}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* Overlay canvas for dartboard guides */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Tap mode hint */}
        {tapMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 rounded-xl px-4 py-3 text-center">
              <p className="text-yellow-400 font-bold text-sm">Сум оносон газрыг дарна уу</p>
              <p className="text-white/60 text-xs mt-1">Самбар дэлгэц дээр хүрнэ</p>
            </div>
          </div>
        )}

        {/* Detecting indicator */}
        {detecting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 rounded-xl px-4 py-3 flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <p className="text-white font-medium text-sm">Оноо тодорхойлж байна…</p>
            </div>
          </div>
        )}

        {/* Pending score preview */}
        {pendingScore && !detecting && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-black/85 backdrop-blur rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-black text-white score-display">{pendingScore.score}</p>
                <p className="text-sm text-primary font-semibold">{pendingScore.label}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingScore(null); setTapMode(true) }}
                  className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/40 flex items-center justify-center"
                  title="Засах"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmScore() }}
                  className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Баталгаажуулах
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="shrink-0 border-t border-border/30 bg-background px-3 pt-3 pb-4 space-y-3">
        {/* Dart boxes */}
        <div className="flex items-center justify-between">
          {/* Active player darts */}
          <div className="flex gap-1.5">
            {darts.map((d, i) => (
              <DartBox
                key={i}
                entry={d}
                active={!turnDone && i === filledCount}
              />
            ))}
          </div>
          {/* Visit info */}
          <div className="text-right">
            {filledCount > 0 && !turnDone && (
              <>
                <p className="text-xs text-muted-foreground">Visit</p>
                <p className="text-lg font-black score-display">{visitTotal}</p>
                <p className="text-xs text-primary font-semibold">→ {activePlayer.remaining - visitTotal}</p>
              </>
            )}
            {checkoutHint && (
              <p className="text-[10px] font-mono text-yellow-400 mt-0.5">🎯 {checkoutHint}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!turnDone ? (
          <div className="flex gap-2">
            <button
              onClick={detectDart}
              disabled={detecting || !!pendingScore || tapMode}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all",
                "bg-primary text-primary-foreground glow-primary hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {detecting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Тодорхойлж байна…</>
                : <><Scan className="h-4 w-4" /> Оноо тодорхойлох</>
              }
            </button>
            {tapMode && (
              <button
                onClick={() => setTapMode(false)}
                className="h-12 w-12 rounded-xl border border-border/40 bg-secondary/50 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => finishTurn(darts, false)}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Дараагийн тоглогч →
          </button>
        )}

        {/* Reference reset */}
        <button
          onClick={captureReference}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Лавлах фрэйм шинэчлэх (сум авсны дараа)
        </button>
      </div>
    </div>
  )
}

export default function CameraGamePage() {
  return (
    <Suspense>
      <CameraGame />
    </Suspense>
  )
}
