"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronLeft, Loader2, Scan, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveCalibration, measureMotion } from "@/lib/dartboard"
import { loadDartModel, isDartModelLoaded, detectBoardCorners, computeCalFromCorners } from "@/lib/dart-model"

interface CameraSetupProps {
  onConfirmed: () => void
  onBack: () => void
}

type AutoStatus = "checking" | "ok" | "bad"
type SetupPhase = "auto" | "calibrate" | "done"

interface TapPoint { x: number; y: number }

const CAL_STEPS = [
  { key: "bullseye" as const, label: "1 / 3 — Bullseye", desc: "Самбарын дунд цэгийг (Bullseye) дарна уу", color: "text-red-400" },
  { key: "t20" as const,      label: "2 / 3 — T20 (12 цаг)", desc: "Дээд хэсгийн T20-ийн голыг дарна уу", color: "text-green-400" },
  { key: "t6" as const,       label: "3 / 3 — T6 (3 цаг)",  desc: "Баруун хэсгийн T6-ийн голыг дарна уу", color: "text-blue-400" },
]

export function CameraSetup({ onConfirmed, onBack }: CameraSetupProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevFrameRef = useRef<ImageData | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [camError, setCamError] = useState<string | null>(null)
  const [phase, setPhase] = useState<SetupPhase>("auto")
  const [lightStatus, setLightStatus] = useState<AutoStatus>("checking")
  const [stabilityStatus, setStabilityStatus] = useState<AutoStatus>("checking")
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-calibration state
  const [autoCalState, setAutoCalState] = useState<"idle" | "loading" | "detecting" | "fail">("idle")
  // Нэг л удаа бэлэн болсон бол товч байнга харагдана (утас хөдрөхөд алга болохгүй)
  const [wasEverReady, setWasEverReady] = useState(false)

  // Manual calibration taps
  const [calStep, setCalStep] = useState<0 | 1 | 2>(0)
  const [bullseyeTap, setBullseyeTap] = useState<TapPoint | null>(null)
  const [t20Tap, setT20Tap] = useState<TapPoint | null>(null)
  const [t6Tap, setT6Tap] = useState<TapPoint | null>(null)

  const allAutoOk = lightStatus === "ok" && stabilityStatus === "ok"

  // ── Start camera ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => { if (active) setCamError("Камер нэвтэрч чадсангүй. Зөвшөөрлийг шалгана уу.") })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ── Auto-analysis (light + stability) ─────────────────────────────────────
  const analyze = useCallback(() => {
    if (phase !== "auto") return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    const W = 120, H = 90
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0, W, H)
    const frame = ctx.getImageData(0, 0, W, H)

    let sum = 0
    for (let i = 0; i < frame.data.length; i += 4)
      sum += frame.data[i] * 0.299 + frame.data[i+1] * 0.587 + frame.data[i+2] * 0.114
    setLightStatus(sum / (frame.data.length / 4) < 35 ? "bad" : "ok")

    if (prevFrameRef.current) {
      setStabilityStatus(measureMotion(prevFrameRef.current, frame, 20) < 0.025 ? "ok" : "checking")
    }
    prevFrameRef.current = frame
  }, [phase])

  useEffect(() => {
    const id = setInterval(analyze, 700)
    return () => clearInterval(id)
  }, [analyze])

  // ── Countdown when checks pass ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "auto") return
    if (allAutoOk) {
      setWasEverReady(true)
      if (countdown === null) {
        setCountdown(3)
        countdownRef.current = setInterval(() => {
          setCountdown((c) => (c === null ? null : c <= 1 ? 0 : c - 1))
        }, 1000)
      }
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      setCountdown(null)
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [allAutoOk, phase])

  useEffect(() => {
    if (countdown === 0 && phase === "auto") {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
      setPhase("calibrate")
    }
  }, [countdown, phase])

  // ── Auto-calibration via YOLO ─────────────────────────────────────────────
  async function runAutoCalibration() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    setAutoCalState("loading")
    try {
      if (!isDartModelLoaded()) await loadDartModel()
      setAutoCalState("detecting")

      // Capture 320×240 frame
      canvas.width = 320; canvas.height = 240
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(video, 0, 0, 320, 240)
      const frame = ctx.getImageData(0, 0, 320, 240)

      const corners = await detectBoardCorners(frame)
      const cal = computeCalFromCorners(corners, 320, 240)

      if (!cal) {
        setAutoCalState("fail")
        return
      }

      saveCalibration(cal)
      sessionStorage.setItem("cam-ready", "1")
      setPhase("done")
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onConfirmed()
    } catch {
      setAutoCalState("fail")
    }
  }

  // ── Manual tap calibration ────────────────────────────────────────────────
  function handleVideoTap(e: React.MouseEvent<HTMLDivElement>) {
    if (phase !== "calibrate") return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (calStep === 0) {
      setBullseyeTap({ x, y }); setCalStep(1)
    } else if (calStep === 1) {
      setT20Tap({ x, y }); setCalStep(2)
    } else {
      setT6Tap({ x, y })
      finishCalibration(bullseyeTap!, t20Tap!, { x, y })
    }
  }

  function finishCalibration(bullseye: TapPoint, t20: TapPoint, t6: TapPoint) {
    saveCalibration({ cx_pct: bullseye.x, cy_pct: bullseye.y, r_pct: 0.26, bullseye_pct: bullseye, t20_pct: t20, t6_pct: t6 })
    sessionStorage.setItem("cam-ready", "1")
    setPhase("done")
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onConfirmed()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-400" />
            Камер тохируулах
          </h2>
          <p className="text-xs text-muted-foreground">
            {phase === "auto" ? "Шалгаж байна…" : phase === "calibrate" ? "Байрлал тэмдэглэх" : "Бэлэн"}
          </p>
        </div>
      </div>

      {camError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{camError}</p>
        </div>
      ) : (
        <>
          {/* Camera feed */}
          <div
            className={cn(
              "relative rounded-xl overflow-hidden bg-zinc-900 aspect-video select-none",
              phase === "calibrate" ? "cursor-crosshair ring-2 ring-primary/50" : ""
            )}
            onClick={handleVideoTap}
          >
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover pointer-events-none" />
            <canvas ref={canvasRef} className="hidden" />

            {phase === "auto" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div style={{ width: "52%", aspectRatio: "1" }} className="relative">
                  <div className={cn(
                    "absolute inset-0 rounded-full border-2 transition-colors duration-500",
                    allAutoOk ? "border-green-400/70" : "border-white/25 border-dashed"
                  )} />
                  <div className="absolute w-px h-4 bg-white/20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute h-px w-4 bg-white/20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {phase === "calibrate" && (
              <>
                {[
                  { tap: bullseyeTap, color: "bg-red-500/80" },
                  { tap: t20Tap,      color: "bg-green-500/80" },
                  { tap: t6Tap,       color: "bg-blue-500/80" },
                ].map(({ tap, color }, i) => tap ? (
                  <div key={i} className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }}>
                    <div className={cn("h-5 w-5 rounded-full border-2 border-white/60 flex items-center justify-center", color)}>
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                ) : null)}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-3 py-2 rounded-xl text-xs font-semibold text-center bg-black/70 text-white">
                    {CAL_STEPS[calStep].desc}
                  </div>
                </div>
              </>
            )}

            {phase === "auto" && countdown !== null && countdown > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-green-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Калибрацид орно {countdown}с…
                </div>
              </div>
            )}

            {/* Auto-cal overlay */}
            {autoCalState === "loading" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-sm text-white font-semibold">AI model ачааллаж байна…</p>
              </div>
            )}
            {autoCalState === "detecting" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <Scan className="h-8 w-8 text-cyan-400 animate-pulse" />
                <p className="text-sm text-white font-semibold">Самбар хайж байна…</p>
              </div>
            )}
          </div>

          {/* Auto phase checks */}
          {phase === "auto" && (
            <div className="space-y-2">
              {[
                { label: "💡 Гэрэл", status: lightStatus, okText: "Гэрэл хангалттай", badText: "Гэрлийг тохируулна уу" },
                { label: "📷 Тогтвор", status: stabilityStatus, okText: "Камер тогтворжсон", badText: "Хөдөлгөөнгүй барина уу…" },
              ].map((c) => (
                <div key={c.label} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors",
                  c.status === "ok" ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-secondary/20"
                )}>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    c.status === "ok" ? "border-green-500 bg-green-500/20" : "border-border"
                  )}>
                    {c.status === "ok"
                      ? <Check className="h-3 w-3 text-green-400" />
                      : <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.status === "ok" ? c.okText : c.badText}
                    </p>
                  </div>
                </div>
              ))}

              {/* Auto-calibrate button — нэг л удаа бэлэн болсон бол харагдана */}
              {wasEverReady && (
                <div className="pt-1 space-y-2">
                  {autoCalState === "fail" && (
                    <p className="text-[11px] text-destructive text-center">
                      Самбар таньж чадсангүй. Гараар тохируулна уу.
                    </p>
                  )}
                  <button
                    onClick={runAutoCalibration}
                    disabled={autoCalState === "loading" || autoCalState === "detecting"}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-semibold disabled:opacity-50"
                  >
                    <Scan className="h-4 w-4" />
                    AI автоматаар тохируулах
                  </button>
                  <button
                    onClick={() => setPhase("calibrate")}
                    className="w-full py-2.5 rounded-xl border border-border/40 text-muted-foreground text-sm"
                  >
                    Гараар тохируулах (3 цэг дарах)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual calibrate phase */}
          {phase === "calibrate" && (
            <div className="space-y-2">
              {CAL_STEPS.map((s, i) => {
                const done = [!!bullseyeTap, !!t20Tap, !!t6Tap][i]
                const active = i === calStep
                return (
                  <div key={s.key} className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors",
                    done ? "border-green-500/30 bg-green-500/5" :
                    active ? "border-primary/40 bg-primary/5" :
                    "border-border/30 bg-secondary/10 opacity-40"
                  )}>
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      done ? "border-green-500 bg-green-500/20" :
                      active ? "border-primary bg-primary/10 animate-pulse" : "border-border"
                    )}>
                      {done && <Check className="h-3 w-3 text-green-400" />}
                    </div>
                    <div>
                      <p className={cn("text-xs font-semibold", active ? s.color : "")}>{s.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                )
              })}
              <p className="text-[11px] text-muted-foreground/60 text-center pt-1">
                Дэлгэцэн дээр яг тухайн хэсгийг дарна уу
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
