"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, Video, VideoOff, X, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { canHandleMatched, shouldReconcile, classifyRoomPlayersInsert } from "@/lib/matchmaking/session-guard"

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
  // Bumped on every new search and on cancel/unmount. Any async callback
  // (join response, realtime event, reconciliation read) captures the
  // session id live at its own start and must recheck it before acting —
  // this is what stops a stale callback from a cancelled or superseded
  // search from navigating or touching state that belongs to a later one.
  const sessionRef = useRef(0)
  // Guards against navigating twice within the SAME session when both the
  // realtime event and the reconciliation read observe "matched".
  const navigatedRef = useRef(false)
  // matchmaking_queue is NOT in the supabase_realtime publication, so a
  // postgres_changes subscription on it can never fire — confirmed against
  // production (pg_publication_tables). room_players IS published and both
  // rows are inserted atomically with the room, so it's the durable signal
  // instead. These three refs support that: the server-clock timestamp this
  // search began at (so reconciliation can't pick up a stale room_players
  // row from an earlier abandoned search), whether the room_players channel
  // has reached SUBSCRIBED, and a one-shot guard on the reconciliation read
  // itself (it must run exactly once per search, once both are true).
  const searchStartedAtRef = useRef<string | null>(null)
  const subscribedRef = useRef(false)
  const reconciledRef = useRef(false)
  // A live room_players INSERT can arrive before searchStartedAt is known
  // (the opponent's claim can complete, and its INSERT reach us, before our
  // own /join response — which carries searchStartedAt — gets back to the
  // browser). classifyRoomPlayersInsert returns "pending" in that case; this
  // holds the one relevant in-flight row so it can be re-evaluated the
  // moment searchStartedAt becomes available, instead of being dropped.
  const pendingInsertRef = useRef<{ roomId: string; joinedAt: string } | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
  }, [])

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
  }, [supabase])

  // Bumps the session counter so any callback still in flight from the
  // search being torn down (join response, realtime event, reconciliation
  // read) fails its session check and no-ops instead of navigating.
  const invalidateSession = useCallback(() => { sessionRef.current++ }, [])

  // Single path to "we have a room, go there" — used by the HTTP-matched
  // response, the realtime UPDATE event, and the post-SUBSCRIBED
  // reconciliation read alike, so all three navigate exactly once, the same
  // way, and none of them can act on behalf of a search that's since been
  // cancelled or superseded.
  const handleMatched = useCallback((roomId: string, mySession: number) => {
    if (!canHandleMatched(sessionRef.current, mySession, navigatedRef.current)) return
    navigatedRef.current = true
    stopTimer()
    cleanupChannel()
    setPhase("matched")
    router.push(`/play/${roomId}`)
  }, [stopTimer, cleanupChannel, router])

  // One-time authoritative catch-up read, run once the room_players channel
  // is confirmed SUBSCRIBED and we know this search's own server-clock start
  // time. Only a room_players row created AFTER this search began, in a
  // matchmaking-created ('random') room, counts — this is what stops it from
  // navigating into an old, abandoned room_players row left over from a
  // previous search the user never actually entered (seen in production:
  // rooms stuck in status='waiting' with a stale membership row). Any match
  // that happens after this point is instead caught live by the INSERT
  // subscription itself, so running this exactly once — not on a timer — is
  // sufficient: it only needs to cover the gap before the channel is live.
  const tryReconcile = useCallback((mySession: number) => {
    if (!shouldReconcile(subscribedRef.current, searchStartedAtRef.current, reconciledRef.current)) return
    reconciledRef.current = true
    supabase
      .from("room_players")
      .select("room_id, joined_at, online_rooms!inner(start_method)")
      .eq("player_id", userId)
      .eq("online_rooms.start_method", "random")
      .gte("joined_at", searchStartedAtRef.current)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.room_id) handleMatched(data.room_id, mySession)
      })
  }, [supabase, userId, handleMatched])

  // Shared verdict-application for a room_players row this player was just
  // added to (either the live INSERT event or the replay of one that had to
  // wait on searchStartedAt) — same rule, same outcome, regardless of which
  // path is currently evaluating it.
  const applyInsertVerdict = useCallback((roomId: string, joinedAt: string, startMethod: string | null, mySession: number) => {
    const verdict = classifyRoomPlayersInsert(startMethod, joinedAt, searchStartedAtRef.current)
    if (verdict === "accept") {
      pendingInsertRef.current = null
      handleMatched(roomId, mySession)
    } else if (verdict === "pending") {
      pendingInsertRef.current = { roomId, joinedAt }
    }
    // "reject": unrelated non-matchmaking room, or a stale row from an
    // earlier abandoned search — silently ignored, nothing to navigate to.
  }, [handleMatched])

  // Reads and clears the held INSERT, if any. Kept as its own function
  // (rather than reading pendingInsertRef.current inline inside
  // startMatchmaking) so a later read isn't seen by TS as narrowed to the
  // `null` assigned at the top of that same function's control flow — that
  // assignment predates any of the async callbacks that can actually set it.
  const consumePendingInsert = useCallback(() => {
    const pending = pendingInsertRef.current
    pendingInsertRef.current = null
    return pending
  }, [])

  const leave = useCallback(async () => {
    invalidateSession()
    stopTimer()
    cleanupChannel()
    setPhase("idle")
    setElapsed(0)
    await fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {})
  }, [stopTimer, cleanupChannel, invalidateSession])

  useEffect(() => {
    return () => {
      invalidateSession()
      stopTimer()
      cleanupChannel()
      fetch("/api/matchmaking/leave", { method: "POST" }).catch(() => {})
    }
  }, [stopTimer, cleanupChannel, invalidateSession])

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

    const mySession = ++sessionRef.current
    navigatedRef.current = false
    reconciledRef.current = false
    subscribedRef.current = false
    searchStartedAtRef.current = null
    pendingInsertRef.current = null

    setPhase("searching")
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
    heartbeatRef.current = setInterval(() => {
      fetch("/api/matchmaking/heartbeat", { method: "POST" }).catch(() => {})
    }, 5000)

    // Realtime — room_players INSERT ажиглана (matchmaking_queue биш: тэр
    // хүснэгт supabase_realtime publication-д алга тул postgres_changes
    // event хэзээ ч ирэхгүй байсан нь production дээр баталгаажсан — 2
    // тоглогчийн мөр хоёулаа room_players-д НЭГ транзакцад орж бичигддэг тул
    // энэ хүснэгт бодит, найдвартай эх сурвалж).
    const ch = supabase
      .channel(`room-players-mm-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "room_players",
        filter: `player_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { room_id: string | null; joined_at: string }
        if (!row.room_id) return
        // The INSERT payload only carries room_players' own columns — a
        // small extra read of the referenced room is needed to confirm it's
        // matchmaking-created ('random') and not e.g. an invite accepted in
        // another tab while this search is running.
        supabase
          .from("online_rooms")
          .select("start_method")
          .eq("id", row.room_id)
          .maybeSingle()
          .then(({ data: room }) => {
            applyInsertVerdict(row.room_id!, row.joined_at, room?.start_method ?? null, mySession)
          })
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return
        subscribedRef.current = true
        tryReconcile(mySession)
      })
    channelRef.current = ch

    // Дараалалд нэмэгдэнэ — шууд тохирвол roomId буцаана
    const res = await fetch("/api/matchmaking/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "501", bestOf: 3, doubleOut: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (typeof data.searchStartedAt === "string") {
      searchStartedAtRef.current = data.searchStartedAt
      // A live INSERT may have arrived (and been provisionally validated as
      // a 'random' room) before this response — and its searchStartedAt —
      // came back. Re-evaluate it now that we can actually tell whether it
      // belongs to this attempt, instead of leaving it stranded.
      const pending = consumePendingInsert()
      if (pending) applyInsertVerdict(pending.roomId, pending.joinedAt, "random", mySession)
    }

    if (data.matched && data.roomId) { handleMatched(data.roomId, mySession); return }
    // Тохирохгүй бол Realtime INSERT-ийг хүлээнэ; channel аль хэдийн
    // SUBSCRIBED болсон бол дээрх join хариу ирэхээс өмнө таарсан байж
    // болзошгүйг энд шалгана (subscribedRef аль хэдийн true бол
    // searchStartedAt дөнгөж ирсэн энэ мөчид reconcile хийнэ).
    tryReconcile(mySession)
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
