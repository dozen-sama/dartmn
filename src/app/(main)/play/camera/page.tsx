"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, Loader2, RotateCcw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CameraSetup } from "@/components/play/CameraSetup"
import {
  detectDartInFrames,
  loadCalibration,
  measureMotion,
  positionToScore,
  type BoardCalibration,
  type DartScore,
} from "@/lib/dartboard"
import { classifyTurn, getCheckout } from "@/lib/local-game/checkouts"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DartEntry { score: DartScore; bust: boolean }
interface Visit { darts: (DartEntry | null)[]; total: number; bust: boolean }
interface PlayerState { name: string; remaining: number; legs: number; visits: Visit[] }

type DetectState = "idle" | "motion" | "settling" | "detected" | "manual"

// ── DartBox ───────────────────────────────────────────────────────────────────

function DartBox({ entry, active }: { entry: DartEntry | null; active?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border-2 transition-all h-14 w-[4rem]",
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
  const refFrameRef = useRef<ImageData | null>(null)   // no-dart reference
  const prevFrameRef = useRef<ImageData | null>(null)  // previous frame for motion
  const streamRef = useRef<MediaStream | null>(null)
  const cal = useRef<BoardCalibration>(loadCalibration())
  const detectState = useRef<DetectState>("idle")
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollId = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase] = useState<"setup" | "game">("setup")
  const [players, setPlayers] = useState<[PlayerState, PlayerState]>([
    { name: "Тоглогч 1", remaining: 501, legs: 0, visits: [] },
    { name: "Тоглогч 2", remaining: 501, legs: 0, visits: [] },
  ])
  const [active, setActive] = useState<0 | 1>(0)
  const [darts, setDarts] = useState<(DartEntry | null)[]>([null, null, null])
  const [detectUiState, setDetectUiState] = useState<DetectState>("idle")
  const [pendingScore, setPendingScore] = useState<DartScore | null>(null)
  const [winner, setWinner] = useState<0 | 1 | null>(null)
  const dartsRef = useRef(darts)
  const activeRef = useRef(active)
  useEffect(() => { dartsRef.current = darts }, [darts])
  useEffect(() => { activeRef.current = active }, [active])

  const filledCount = darts.filter(Boolean).length
  const visitTotal = darts.reduce((a, d) => a + (d && !d.bust ? d.score.score : 0), 0)
  const turnDone = filledCount === 3 || darts.some((d) => d?.bust)
  const remaining = players[active].remaining - visitTotal
  const checkoutHint = !turnDone && remaining > 1 ? getCheckout(remaining) : null

  // ── Capture helpers ────────────────────────────────────────────────────────

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null
    // Use downsampled frame for speed
    canvas.width = 320; canvas.height = 240
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0, 320, 240)
    return ctx.getImageData(0, 0, 320, 240)
  }, [])

  const captureReference = useCallback(() => {
    const frame = captureFrame()
    if (frame) refFrameRef.current = frame
  }, [captureFrame])

  // ── Score detection ────────────────────────────────────────────────────────

  const runDetect = useCallback(() => {
    const cur = captureFrame()
    if (!cur || !refFrameRef.current) return

    const { cx_pct, cy_pct, r_pct } = cal.current
    const cx = cx_pct * 320
    const cy = cy_pct * 240
    const boardR = r_pct * 320

    const hit = detectDartInFrames(refFrameRef.current, cur, cx, cy, boardR)
    if (!hit) {
      // Nothing found → let user tap
      detectState.current = "manual"
      setDetectUiState("manual")
      return
    }

    const score = positionToScore(hit.px - cx, hit.py - cy, boardR)
    detectState.current = "detected"
    setDetectUiState("detected")
    setPendingScore(score)
  }, [captureFrame])

  // ── Motion-triggered polling ───────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollId.current) return
    pollId.current = setInterval(() => {
      if (dartsRef.current.filter(Boolean).length >= 3) return
      const cur = captureFrame()
      if (!cur) return

      const prev = prevFrameRef.current
      prevFrameRef.current = cur
      if (!prev) return

      const motion = measureMotion(prev, cur, 20)
      const state = detectState.current

      if (state === "idle" && motion > 0.05) {
        // Motion started (player is throwing)
        detectState.current = "motion"
        setDetectUiState("motion")
        if (settleTimer.current) clearTimeout(settleTimer.current)
      } else if (state === "motion" && motion < 0.02) {
        // Motion stopped (dart settled)
        detectState.current = "settling"
        setDetectUiState("settling")
        settleTimer.current = setTimeout(() => {
          if (detectState.current === "settling") runDetect()
        }, 1000) // wait 1s after settling
      }
    }, 200)
  }, [captureFrame, runDetect])

  const stopPolling = useCallback(() => {
    if (pollId.current) { clearInterval(pollId.current); pollId.current = null }
    if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null }
  }, [])

  // ── Camera start ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "game") return
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        // Capture reference after a short delay for stream to start
        setTimeout(captureReference, 1500)
        startPolling()
      })
      .catch(() => {})
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      stopPolling()
    }
  }, [phase, captureReference, startPolling, stopPolling])

  // ── Confirm score ─────────────────────────────────────────────────────────

  function confirmScore() {
    if (!pendingScore) return
    const idx = dartsRef.current.filter(Boolean).length
    const currentRemaining = players[activeRef.current].remaining -
      dartsRef.current.reduce((a, d) => a + (d && !d.bust ? d.score.score : 0), 0)
    const outcome = classifyTurn(currentRemaining, pendingScore.score, { doubleOut: true, requireBullFinish: false })
    const bust = outcome.type === "bust"

    const entry: DartEntry = { score: pendingScore, bust }
    const newDarts = [...dartsRef.current] as (DartEntry | null)[]
    newDarts[idx] = entry
    setDarts(newDarts)
    setPendingScore(null)
    detectState.current = "idle"
    setDetectUiState("idle")

    // Update reference to include this dart for next detection
    setTimeout(captureReference, 400)

    if (outcome.type === "checkout") {
      finishTurn(newDarts, true)
    } else if (bust) {
      setTimeout(() => finishTurn(newDarts, false), 600)
    }
  }

  function finishTurn(finalDarts: (DartEntry | null)[], checkout: boolean) {
    const total = finalDarts.reduce((a, d) => a + (d && !d.bust ? d.score.score : 0), 0)
    const bust = finalDarts.some((d) => d?.bust)
    const scored = bust ? 0 : total
    const visit: Visit = { darts: finalDarts, total, bust }

    setPlayers((prev) => {
      const next: [PlayerState, PlayerState] = [{ ...prev[0] }, { ...prev[1] }]
      next[activeRef.current] = {
        ...prev[activeRef.current],
        remaining: prev[activeRef.current].remaining - scored,
        visits: [...prev[activeRef.current].visits, visit],
      }
      if (checkout) {
        next[activeRef.current].legs = prev[activeRef.current].legs + 1
        if (next[activeRef.current].legs >= 3) { setWinner(activeRef.current); return next }
        next[0].remaining = 501
        next[1].remaining = 501
      }
      return next
    })

    setDarts([null, null, null])
    setActive((p) => (p === 0 ? 1 : 0))
    detectState.current = "idle"
    setDetectUiState("idle")
    // Capture fresh reference for the new player's turn
    setTimeout(captureReference, 600)
  }

  // Manual tap on video
  function handleVideoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (detectUiState !== "manual") return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const tapX = (e.clientX - rect.left) / rect.width
    const tapY = (e.clientY - rect.top) / rect.height
    const { cx_pct, cy_pct, r_pct } = cal.current
    const dx = (tapX - cx_pct) * rect.width
    const dy = (tapY - cy_pct) * rect.height
    const boardR = r_pct * rect.width
    const score = positionToScore(dx, dy, boardR)
    setPendingScore(score)
    detectState.current = "detected"
    setDetectUiState("detected")
  }

  // ── Setup phase ───────────────────────────────────────────────────────────

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
        <h2 className="text-2xl font-black">{players[winner].name} ялав!</h2>
        <button onClick={() => router.back()}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
          Буцах
        </button>
      </div>
    )
  }

  // ── Status label ──────────────────────────────────────────────────────────

  const statusLabel: Record<DetectState, string> = {
    idle:     "Хүлээж байна…",
    motion:   "Шидэж байна…",
    settling: "Тогтоож байна…",
    detected: "",
    manual:   "Сум оносон газрыг дарна уу",
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border/30">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-3">
          {([0, 1] as const).map((i) => (
            <div key={i} className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors",
              active === i ? "bg-primary/15" : "opacity-45"
            )}>
              <span className={cn("text-xs font-bold truncate max-w-16", active === i ? "text-primary" : "text-foreground")}>
                {players[i].name}
              </span>
              <span className={cn("text-lg font-black score-display", active === i ? "text-foreground" : "text-muted-foreground")}>
                {players[i].remaining}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      </div>

      {/* ── Camera feed ── */}
      <div
        className={cn(
          "relative flex-1 bg-black overflow-hidden",
          detectUiState === "manual" ? "cursor-crosshair ring-2 ring-yellow-400 ring-inset" : "cursor-default"
        )}
        onClick={handleVideoTap}
      >
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Dartboard circle overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{ width: "52%", aspectRatio: "1" }} className="relative">
            <div className={cn(
              "absolute inset-0 rounded-full border-2 transition-colors",
              detectUiState === "detected" ? "border-green-400/60" :
              detectUiState === "motion" || detectUiState === "settling" ? "border-yellow-400/60" :
              "border-white/20 border-dashed"
            )} />
          </div>
        </div>

        {/* State overlay */}
        {detectUiState !== "idle" && detectUiState !== "detected" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
              detectUiState === "motion" ? "bg-yellow-500/80 text-black" :
              detectUiState === "settling" ? "bg-blue-500/80 text-white" :
              detectUiState === "manual" ? "bg-yellow-500/80 text-black" :
              "bg-black/60 text-white"
            )}>
              {detectUiState === "settling" && <Loader2 className="h-3 w-3 animate-spin" />}
              {statusLabel[detectUiState]}
            </div>
          </div>
        )}

        {/* Pending score overlay */}
        {pendingScore && detectUiState === "detected" && (
          <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
            <div className="bg-black/88 backdrop-blur rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-black text-white score-display">{pendingScore.score}</p>
                <p className="text-sm font-semibold text-primary">{pendingScore.label}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingScore(null); detectState.current = "manual"; setDetectUiState("manual") }}
                  className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/40 flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); confirmScore() }}
                  className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Зөв
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 border-t border-border/30 bg-background px-3 pt-3 pb-4 space-y-3">
        {/* Dart boxes + visit info */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {darts.map((d, i) => (
              <DartBox key={i} entry={d} active={!turnDone && i === filledCount} />
            ))}
          </div>
          <div className="text-right space-y-0.5">
            {filledCount > 0 && !turnDone && (
              <>
                <p className="text-lg font-black score-display">{visitTotal}</p>
                <p className="text-xs text-primary font-semibold">→ {remaining}</p>
              </>
            )}
            {checkoutHint && <p className="text-[10px] font-mono text-yellow-400">🎯 {checkoutHint}</p>}
          </div>
        </div>

        {/* Next turn button */}
        {turnDone && (
          <button
            onClick={() => finishTurn(darts, false)}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Дараагийн тоглогч →
          </button>
        )}

        {/* Reference reset */}
        <button
          onClick={() => { captureReference(); detectState.current = "idle"; setDetectUiState("idle") }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Лавлах фрэйм шинэчлэх (сум авах үед дарна)
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
