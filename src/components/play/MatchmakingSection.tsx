"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, Video, VideoOff, X, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Phase =
  | "idle"          // товч харуулна
  | "cam-check"     // камерын зөвшөөрөл шалгаж байна
  | "cam-denied"    // камер нэвтрэхийг татгалзсан
  | "searching"     // дараалалд байна
  | "matched"       // тоглогч олдлоо, redirect хүлээж байна

interface Props {
  userId: string
  ratingPoints: number
  displayName: string
}

export function MatchmakingSection({ userId, ratingPoints, displayName }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [supabase] = useState(() => createClient())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
  }, [])

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
  }, [supabase])

  const leave = useCallback(async () => {
    stopTimer()
    cleanupChannel()
    setPhase("idle")
    setElapsed(0)
    await fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {})
  }, [stopTimer, cleanupChannel])

  useEffect(() => {
    return () => {
      stopTimer()
      cleanupChannel()
      fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {})
    }
  }, [stopTimer, cleanupChannel])

  // React's unmount cleanup above only fires on in-app navigation, not on an
  // actual tab close/refresh/crash — that's exactly how ghost queue entries
  // get left behind. sendBeacon on pagehide reaches the server even as the
  // page is torn down; the server-side heartbeat staleness check in
  // matchmaking_claim_match is the backstop if even this doesn't fire.
  useEffect(() => {
    if (phase !== "searching") return
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return // bfcache-д хадгалагдаж байгаа тул queue-г устгах шаардлагагүй
      navigator.sendBeacon?.("/api/matchmaking/leave")
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [phase])

  async function startMatchmaking() {
    setPhase("cam-check")

    // Камерын зөвшөөрөл шалгана — хэрэглэгч нэвтрэх зөвшөөрөл өгч байна
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach((t) => t.stop())  // зөвшөөрөл баталгаажсан, stream зогсооно
    } catch {
      setPhase("cam-denied")
      return
    }

    setPhase("searching")
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
    heartbeatRef.current = setInterval(() => {
      fetch("/api/matchmaking/heartbeat", { method: "POST" }).catch(() => {})
    }, 5000)

    // Realtime — дараалалд өөрийн entry-г ажиглана
    const ch = supabase
      .channel(`mmq-${userId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "matchmaking_queue",
        filter: `player_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { status: string; room_id: string | null }
        if (row.status === "matched" && row.room_id) {
          stopTimer()
          cleanupChannel()
          setPhase("matched")
          router.push(`/play/${row.room_id}`)
        }
      })
      .subscribe()
    channelRef.current = ch

    // Дараалалд нэмэгдэнэ — шууд тохирвол roomId буцаана
    const res = await fetch("/api/matchmaking/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "501", bestOf: 3, doubleOut: true }),
    })
    const data = await res.json().catch(() => ({}))

    if (data.matched && data.roomId) {
      stopTimer()
      cleanupChannel()
      setPhase("matched")
      router.push(`/play/${data.roomId}`)
    }
    // Тохирохгүй бол Realtime-ийн хариуг хүлээнэ
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  if (phase === "idle") {
    return (
      <button
        onClick={startMatchmaking}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group"
      >
        <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/25 transition-colors">
          <Zap className="h-5 w-5 text-blue-400" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold">ELO хайлт</p>
            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">Камер шаардлагатай</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Ойролцоо рейтингтэй тоглогч хайна · {ratingPoints} ELO ±300
          </p>
        </div>
        <Video className="h-4 w-4 text-blue-400 shrink-0" />
      </button>
    )
  }

  if (phase === "cam-denied") {
    return (
      <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 px-4 py-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <VideoOff className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm font-semibold text-destructive">Камер нэвтрэх зөвшөөрөл байхгүй</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ELO хайлт камер шаардлагатай. Браузерийн тохиргооноос камерын зөвшөөрлийг идэвхжүүлнэ үү.
        </p>
        <button
          onClick={() => setPhase("idle")}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" /> Буцах
        </button>
      </div>
    )
  }

  if (phase === "cam-check") {
    return (
      <div className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
        <p className="text-sm text-muted-foreground">Камерын зөвшөөрөл шалгаж байна…</p>
      </div>
    )
  }

  if (phase === "matched") {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3.5 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-green-400 animate-ping" />
        <p className="text-sm font-semibold text-green-400">Тоглогч олдлоо! Өрөөнд очиж байна…</p>
      </div>
    )
  }

  // searching
  return (
    <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative h-5 w-5 shrink-0">
            <Search className="h-4 w-4 text-blue-400 absolute inset-0.5 animate-pulse" />
          </div>
          <p className="text-sm font-semibold">Тоглогч хайж байна…</p>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">{fmtTime(elapsed)}</span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <div className={cn("h-1.5 w-1.5 rounded-full bg-blue-400",
          elapsed < 30 ? "animate-pulse" : elapsed < 60 ? "" : "bg-yellow-400")
        } />
        {elapsed < 30
          ? `${ratingPoints} ±300 ELO хайлт`
          : elapsed < 60
          ? `${ratingPoints} ±500 ELO хайлт (өргөтгөж байна)`
          : `${ratingPoints} ±800 ELO — ямар ч рейтинг`}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] text-blue-400/70 bg-blue-500/10 rounded-full px-2 py-0.5">
          <Video className="h-3 w-3" />
          Камер бэлэн — өрөөнд асааж болно
        </div>
        <button
          onClick={leave}
          className="ml-auto text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" /> Цуцлах
        </button>
      </div>
    </div>
  )
}
