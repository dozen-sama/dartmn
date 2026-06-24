"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronLeft, Loader2, Sun, Video } from "lucide-react"
import { cn } from "@/lib/utils"

type LightStatus = "checking" | "good" | "dark" | "bright"

interface CameraSetupProps {
  onConfirmed: () => void
  onBack: () => void
}

export function CameraSetup({ onConfirmed, onBack }: CameraSetupProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [camError, setCamError] = useState<string | null>(null)
  const [lightStatus, setLightStatus] = useState<LightStatus>("checking")
  const [boardConfirmed, setBoardConfirmed] = useState(false)
  const [distConfirmed, setDistConfirmed] = useState(false)
  const [ready, setReady] = useState(false)

  // Камер нээнэ
  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (active) setCamError("Камер нэвтэрч чадсангүй. Зөвшөөрлийг шалгана уу.")
      })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Гэрлийн шинжилгээ — canvas-аар 2 секунд тутам
  const analyzeLight = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = 80, H = 80
    canvas.width = W; canvas.height = H
    ctx.drawImage(video, 0, 0, W, H)
    const { data } = ctx.getImageData(0, 0, W, H)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    }
    const avg = sum / (data.length / 4)
    if (avg < 40) setLightStatus("dark")
    else if (avg > 210) setLightStatus("bright")
    else setLightStatus("good")
  }, [])

  useEffect(() => {
    const id = setInterval(analyzeLight, 2000)
    return () => clearInterval(id)
  }, [analyzeLight])

  // Бүх шалгалт давсан бол ready болно
  useEffect(() => {
    setReady(lightStatus === "good" && boardConfirmed && distConfirmed)
  }, [lightStatus, boardConfirmed, distConfirmed])

  function handleConfirm() {
    // Камерын зөвшөөрөл бэлэн — session-д тэмдэглэнэ
    sessionStorage.setItem("cam-ready", "1")
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
          <p className="text-xs text-muted-foreground">Дартын самбарыг зөв байрлуулна уу</p>
        </div>
      </div>

      {camError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-destructive font-medium">{camError}</p>
            <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Буцах</button>
          </div>
        </div>
      ) : (
        <>
          {/* Live camera feed */}
          <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Dartboard target overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Outer guide ring */}
              <div className="relative flex items-center justify-center"
                style={{ width: "52%", aspectRatio: "1" }}>
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/40" />
                {/* Center crosshair */}
                <div className="absolute w-px h-4 bg-white/40" />
                <div className="absolute h-px w-4 bg-white/40" />
                {/* Label */}
                <span className="absolute -bottom-6 text-[10px] text-white/70 whitespace-nowrap">
                  Самбар энд байрлана
                </span>
              </div>
            </div>

            {/* Light status badge */}
            <div className={cn(
              "absolute top-2 right-2 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium",
              lightStatus === "good" ? "bg-green-500/80 text-white" :
              lightStatus === "dark" ? "bg-zinc-800/90 text-yellow-300" :
              lightStatus === "bright" ? "bg-yellow-500/80 text-black" :
              "bg-zinc-800/80 text-white/60"
            )}>
              <Sun className="h-3 w-3" />
              {lightStatus === "good" ? "Гэрэл сайн" :
               lightStatus === "dark" ? "Хэтэрхий харанхуй" :
               lightStatus === "bright" ? "Хэтэрхий гэрэлтэй" :
               <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {/* Light — auto */}
            <div className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 border",
              lightStatus === "good"
                ? "border-green-500/30 bg-green-500/5"
                : lightStatus === "dark"
                ? "border-yellow-500/30 bg-yellow-500/5"
                : "border-border/40 bg-secondary/20"
            )}>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                lightStatus === "good" ? "border-green-500 bg-green-500/20" : "border-border"
              )}>
                {lightStatus === "good" && <Check className="h-3 w-3 text-green-400" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">💡 Гэрэл</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lightStatus === "dark"
                    ? "Хэтэрхий харанхуй байна. Гэрлийг нэмэрнэ үү."
                    : lightStatus === "bright"
                    ? "Хэтэрхий гэрэлтэй. Гэрлийг бага зэрэг бууруулна уу."
                    : "Самбар тод, гэрэл хангалттай байх ёстой"}
                </p>
              </div>
            </div>

            {/* Distance — manual */}
            <button
              onClick={() => setDistConfirmed((v) => !v)}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg px-3 py-2.5 border text-left transition-colors",
                distConfirmed ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-secondary/20 hover:border-border"
              )}>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                distConfirmed ? "border-green-500 bg-green-500/20" : "border-border"
              )}>
                {distConfirmed && <Check className="h-3 w-3 text-green-400" />}
              </div>
              <div>
                <p className="text-xs font-semibold">📏 Зай (1.5 – 2.5 м)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Самбараас ойролцоогоор 2 метр зайд байрлуулна. Бүтэн самбар харагдах ёстой.
                </p>
              </div>
            </button>

            {/* Board visible — manual */}
            <button
              onClick={() => setBoardConfirmed((v) => !v)}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg px-3 py-2.5 border text-left transition-colors",
                boardConfirmed ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-secondary/20 hover:border-border"
              )}>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                boardConfirmed ? "border-green-500 bg-green-500/20" : "border-border"
              )}>
                {boardConfirmed && <Check className="h-3 w-3 text-green-400" />}
              </div>
              <div>
                <p className="text-xs font-semibold">🎯 Самбар дугуй хэлбэрт харагдаж байна</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Самбар дээрх тойргийн зааварт таарч байвал тэмдэглэнэ үү.
                </p>
              </div>
            </button>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={!ready}
            className={cn(
              "w-full py-3 rounded-xl font-bold text-sm transition-all",
              ready
                ? "bg-primary text-primary-foreground glow-primary hover:bg-primary/90"
                : "bg-secondary/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            {ready ? "✓ Тохиргоо бэлэн — тоглолт эхлэх" : "Дээрх шалгалтуудыг бөглөнө үү"}
          </button>
        </>
      )}
    </div>
  )
}
