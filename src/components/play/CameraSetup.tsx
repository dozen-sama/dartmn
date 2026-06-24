"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronLeft, Loader2, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveCalibration, measureMotion } from "@/lib/dartboard"

interface CameraSetupProps {
  onConfirmed: () => void
  onBack: () => void
}

type Status = "checking" | "ok" | "bad"

export function CameraSetup({ onConfirmed, onBack }: CameraSetupProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevFrameRef = useRef<ImageData | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [camError, setCamError] = useState<string | null>(null)
  const [lightStatus, setLightStatus] = useState<Status>("checking")
  const [stabilityStatus, setStabilityStatus] = useState<Status>("checking")
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const allOk = lightStatus === "ok" && stabilityStatus === "ok"

  // Start camera
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

  // Auto-analysis every 800ms
  const analyze = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const W = 120, H = 90
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, W, H)
    const { data } = ctx.getImageData(0, 0, W, H)

    // Light check
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }
    const avg = sum / (data.length / 4)
    setLightStatus(avg < 35 ? "bad" : avg > 215 ? "bad" : "ok")

    // Stability check (motion between frames)
    const curFrame = ctx.getImageData(0, 0, W, H)
    if (prevFrameRef.current) {
      const motion = measureMotion(prevFrameRef.current, curFrame, 20)
      setStabilityStatus(motion < 0.03 ? "ok" : "checking") // < 3% pixels changed = stable
    }
    prevFrameRef.current = curFrame
  }, [])

  useEffect(() => {
    const id = setInterval(analyze, 800)
    return () => clearInterval(id)
  }, [analyze])

  // Start countdown when all OK, cancel if conditions break
  useEffect(() => {
    if (allOk) {
      if (countdown === null) {
        setCountdown(3)
        countdownRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c === null) return null
            if (c <= 1) return 0
            return c - 1
          })
        }, 1000)
      }
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = null
      setCountdown(null)
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [allOk])

  // Auto-confirm when countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      if (countdownRef.current) clearInterval(countdownRef.current)
      saveCalibration({ cx_pct: 0.5, cy_pct: 0.5, r_pct: 0.26 })
      sessionStorage.setItem("cam-ready", "1")
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onConfirmed()
    }
  }, [countdown, onConfirmed])

  const checks = [
    {
      label: "💡 Гэрэл",
      status: lightStatus,
      okText: "Гэрэл хангалттай",
      badText: lightStatus === "bad" ? "Гэрлийг тохируулна уу" : "Хэмжиж байна…",
    },
    {
      label: "📷 Камер тогтвортой",
      status: stabilityStatus,
      okText: "Камер тогтворжсон",
      badText: "Хөдөлгөөнгүй барина уу…",
    },
  ]

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
          <p className="text-xs text-muted-foreground">Самбарыг дугуй хүрээнд байрлуулна уу</p>
        </div>
      </div>

      {camError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{camError}</p>
        </div>
      ) : (
        <>
          {/* Live camera feed */}
          <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Dartboard target overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative flex items-center justify-center" style={{ width: "52%", aspectRatio: "1" }}>
                <div className={cn(
                  "absolute inset-0 rounded-full border-2 transition-colors",
                  allOk ? "border-green-400/70" : "border-white/30 border-dashed"
                )} />
                <div className="absolute w-px h-5 bg-white/30" />
                <div className="absolute h-px w-5 bg-white/30" />
                <span className="absolute -bottom-7 text-[10px] text-white/60 whitespace-nowrap">
                  Самбар энд байрлана — 30-60 см зайтай
                </span>
              </div>
            </div>

            {/* Countdown overlay */}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                <div className="bg-green-500/80 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                  {countdown}с…
                </div>
              </div>
            )}
          </div>

          {/* Auto-checks */}
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.label} className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors",
                c.status === "ok" ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-secondary/20"
              )}>
                <div className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  c.status === "ok" ? "border-green-500 bg-green-500/20" : "border-border"
                )}>
                  {c.status === "ok"
                    ? <Check className="h-3 w-3 text-green-400" />
                    : <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {c.status === "ok" ? c.okText : c.badText}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className={cn(
            "w-full py-3 rounded-xl font-bold text-sm text-center transition-all",
            allOk
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-secondary/50 text-muted-foreground border border-border/30"
          )}>
            {allOk
              ? countdown !== null && countdown > 0
                ? `Бэлэн болж байна — ${countdown}с…`
                : "Шалгаж байна…"
              : "Дээрх шаардлагуудыг хангана уу"
            }
          </div>
        </>
      )}
    </div>
  )
}
