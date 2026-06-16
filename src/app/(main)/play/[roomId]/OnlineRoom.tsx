"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, Copy, Delete, Loader2, LogOut, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AccountLinkPicker, type LinkedAccount } from "@/components/game/AccountLinkPicker"
import { DartSelector } from "@/components/game/DartSelector"
import { createClient } from "@/lib/supabase/client"
import { getTier } from "@/lib/rating"
import { teamSize, totalPlayers, type RoomMode } from "@/lib/local-game/room"
import { deriveX01 } from "@/lib/local-game/x01"
import { classifyTurn, getCheckout, isPossibleVisitScore } from "@/lib/local-game/checkouts"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import type { OnlineRoom as Room, RoomVisit } from "@/types/database"

const KEYPAD = [[7, 8, 9], [4, 5, 6], [1, 2, 3], ["*", 0, "DEL"]] as const

interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  rating_points: number
}

export interface RoomPlayerView {
  player_id: string
  team: number
  slot: number
  is_ready: boolean
  profile: Profile | null
}

interface InviteView {
  id: string
  invitee_id: string
  team: number
  slot: number
  profile: Profile | null
}

interface MyInvite { id: string; team: number; slot: number; status: string }

interface Props {
  room: Room
  players: RoomPlayerView[]
  myInvite: MyInvite | null
  currentUserId: string
  hostName: string
}

export function OnlineRoom({ room, players, myInvite, currentUserId, hostName }: Props) {
  const router = useRouter()
  // Тогтвортой client — render бүрд шинэ үүсгэвэл realtime subscription байнга
  // салж-холбогдож event алдагдана
  const [supabase] = useState(() => createClient())
  const [liveRoom, setLiveRoom] = useState<Room>(room)
  const [livePlayers, setLivePlayers] = useState<RoomPlayerView[]>(players)
  const [invites, setInvites] = useState<InviteView[]>([])
  const [invite, setInvite] = useState<MyInvite | null>(myInvite)
  const [busy, setBusy] = useState(false)
  const joinedRef = useRef(false)
  // Тоглоомын фаз — event-sourced visits
  const [visits, setVisits] = useState<RoomVisit[]>([])
  const visitsLoadedRef = useRef(false)
  const [input, setInput] = useState("")
  const [dartsUsed, setDartsUsed] = useState(3)
  const [submitting, setSubmitting] = useState(false)

  const mode = liveRoom.mode as RoomMode
  const n = teamSize(mode)
  const me = livePlayers.find((p) => p.player_id === currentUserId) ?? null
  const isHost = liveRoom.host_id === currentUserId

  // Бүх төлвийг сэргээнэ (realtime өөрчлөлт бүрд). Бие даасан query-г зэрэг
  const refresh = useCallback(async () => {
    const [{ data: r }, { data: rp }, { data: inv }] = await Promise.all([
      supabase.from("online_rooms").select("*").eq("id", room.id).maybeSingle(),
      supabase.from("room_players").select("*").eq("room_id", room.id),
      supabase.from("room_invites")
        .select("id, invitee_id, team, slot, status").eq("room_id", room.id).eq("status", "pending"),
    ])
    if (r) setLiveRoom(r)
    const ids = [...new Set([...(rp ?? []).map((p) => p.player_id), ...(inv ?? []).map((i) => i.invitee_id)])]
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name, username, avatar_url, rating_points").in("id", ids)
      : { data: [] as Profile[] }
    const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p as Profile]))
    setLivePlayers((rp ?? []).map((p) => ({
      player_id: p.player_id, team: p.team, slot: p.slot, is_ready: p.is_ready, profile: byId[p.player_id] ?? null,
    })))
    setInvites((inv ?? []).map((i) => ({
      id: i.id, invitee_id: i.invitee_id, team: i.team, slot: i.slot, profile: byId[i.invitee_id] ?? null,
    })))
    const mineInv = (inv ?? []).find((i) => i.invitee_id === currentUserId)
    setInvite(mineInv ? { id: mineInv.id, team: mineInv.team, slot: mineInv.slot, status: "pending" } : null)
  }, [room.id, currentUserId, supabase])

  // Realtime — өрөө, тоглогчид, урилгууд (refresh), visits (append)
  useEffect(() => {
    const ch = supabase.channel(`room-${room.id}`)
    for (const table of ["online_rooms", "room_players", "room_invites"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table,
        filter: table === "online_rooms" ? `id=eq.${room.id}` : `room_id=eq.${room.id}` },
        () => { refresh() })
    }
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "room_visits",
      filter: `room_id=eq.${room.id}` }, (payload) => {
      const v = payload.new as RoomVisit
      setVisits((prev) => prev.some((x) => x.seq === v.seq) ? prev : [...prev, v].sort((a, b) => a.seq - b.seq))
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id, refresh, supabase])

  // Тоглолт эхэлсэн/дууссан үед visits-ийг нэг удаа татна
  useEffect(() => {
    if (liveRoom.status === "waiting" || visitsLoadedRef.current) return
    visitsLoadedRef.current = true
    supabase.from("room_visits").select("*").eq("room_id", room.id).order("seq")
      .then(({ data }) => { if (data) setVisits(data as RoomVisit[]) })
  }, [liveRoom.status, room.id, supabase])

  // Кодоор орсон тоглогч (уригдаагүй, ороогүй) → дараагийн нээлттэй slot
  useEffect(() => {
    if (joinedRef.current) return
    if (liveRoom.status !== "waiting") return
    if (me || invite) return
    joinedRef.current = true
    fetch(`/api/play/room/${room.id}/join`, { method: "POST" })
      .then((r) => { if (!r.ok) joinedRef.current = false; return refresh() })
      .catch(() => { joinedRef.current = false })
  }, [liveRoom.status, me, invite, room.id, refresh])

  function copyCode() {
    navigator.clipboard.writeText(liveRoom.room_code)
    toast.success("Код хуулагдлаа")
  }

  async function post(url: string, body?: unknown) {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? "Алдаа гарлаа")
        return false
      }
      await refresh()
      return true
    } finally { setBusy(false) }
  }

  async function toggleReady() {
    if (!me) return
    const next = !me.is_ready
    // Optimistic — өөрийн төлвийг шууд харуулна (round-trip хүлээхгүй)
    setLivePlayers((prev) => prev.map((p) => p.player_id === currentUserId ? { ...p, is_ready: next } : p))
    await post(`/api/play/room/${room.id}/ready`, { ready: next })
  }
  async function invitePlayer(team: number, slot: number, acc: LinkedAccount) {
    const ok = await post(`/api/play/room/${room.id}/invite`, { inviteeId: acc.id, team, slot })
    if (ok) toast.success(`@${acc.username} уригдлаа`)
  }
  async function respondInvite(action: "accept" | "decline") {
    if (!invite) return
    const ok = await post(`/api/play/room/invite/${invite.id}`, { action })
    if (ok && action === "decline") router.push("/play")
  }
  async function leave() {
    await fetch(`/api/play/room/${room.id}/leave`, { method: "POST" }).catch(() => {})
    router.push("/play")
  }

  async function submitTurn(points: number, darts: number) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/play/room/${room.id}/turn`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, darts }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? "Алдаа гарлаа")
        return
      }
      const d = await res.json()
      // Optimistic — өөрийн ээлжийг шууд харуулна (realtime echo dedupe-ээр давхцахгүй)
      if (d.visit) {
        setVisits((prev) => prev.some((x) => x.seq === d.visit.seq) ? prev : [...prev, {
          id: `local-${d.visit.seq}`, room_id: room.id, created_by: currentUserId,
          created_at: new Date().toISOString(), ...d.visit,
        } as RoomVisit].sort((a, b) => a.seq - b.seq))
      }
      setInput(""); setDartsUsed(3)
    } finally { setSubmitting(false) }
  }

  const filled = livePlayers.length
  const need = totalPlayers(mode)
  const playerAt = (team: number, slot: number) => livePlayers.find((p) => p.team === team && p.slot === slot)
  const inviteAt = (team: number, slot: number) => invites.find((i) => i.team === team && i.slot === slot)

  // ── GAME PHASE — TV маягийн онооны самбар ─────────────────
  if (liveRoom.status === "ongoing" || liveRoom.status === "completed") {
    const startScore = parseInt(liveRoom.format) || 501
    const legsToWin = Math.ceil(liveRoom.best_of / 2)
    const sorted = [...visits].sort((a, b) => a.seq - b.seq)
    const d = deriveX01(sorted.map((v) => ({ points: v.points, darts: v.darts })), {
      startScore, doubleOut: liveRoom.double_out, legsToWin,
      starterTeam: liveRoom.starter_team ?? 0, teamSizes: [n, n],
    })
    const winnerTeam = d.winner ?? liveRoom.winner_team
    const done = liveRoom.status === "completed" || d.winner !== null
    const activeTeam = d.activeTeam
    const activeSlot = d.currentPlayer[activeTeam]
    const activeP = playerAt(activeTeam, activeSlot)
    const isMyTurn = !done && activeP?.player_id === currentUserId

    const nameOf = (t: number, s: number) => playerAt(t, s)?.profile?.display_name ?? "Тоглогч"
    const bigName = (t: number) => n === 1 ? nameOf(t, 0) : `Баг ${t + 1}`
    const subName = (t: number) => n === 1 ? null : nameOf(t, d.currentPlayer[t])

    const curLeg = d.legsView[d.legsView.length - 1] ?? []
    const t0 = curLeg.filter((v) => v.team === 0)
    const t1 = curLeg.filter((v) => v.team === 1)
    const activeRound = (activeTeam === 0 ? t0.length : t1.length) + 1
    const rowCount = Math.max(t0.length, t1.length, activeRound)

    const beforeActive = d.scores[activeTeam]
    const inputNum = parseInt(input) || 0
    const preview = input !== "" ? classifyTurn(beforeActive, inputNum, { doubleOut: liveRoom.double_out }) : null
    const isBust = preview?.type === "bust"
    const isCheckout = preview?.type === "checkout"
    const checkoutHint = beforeActive <= 170 ? getCheckout(beforeActive) : null

    const keypad = (k: number | string) => {
      if (k === "DEL") { setInput((p) => p.slice(0, -1)); return }
      if (k === "*") { setInput(""); return }
      setInput((p) => { const next = p + k; return parseInt(next) > 180 ? p : next })
    }
    const doSubmit = () => {
      if (input === "" || submitting || !isMyTurn) return
      if (!isPossibleVisitScore(inputNum)) { toast.error(`${inputNum} — 3 дартаар гаргах боломжгүй оноо`); return }
      submitTurn(inputNum, isCheckout ? dartsUsed : 3)
    }

    const scoreCell = (v: typeof t0[number] | undefined, side: 0 | 1) => {
      if (!v) return <div className="h-9" />
      return (
        <div className={cn("h-9 w-full flex items-center", side === 0 ? "justify-end pr-3" : "justify-start pl-3")}>
          <span className={cn("text-3xl font-bold score-display leading-none",
            v.bust ? "text-destructive/50 line-through" : v.checkout ? "text-green-400" : "text-foreground/85")}>
            {v.points}
          </span>
        </div>
      )
    }

    return (
      <div className="max-w-sm mx-auto space-y-3">
        {/* Top bar */}
        <div className="flex items-center gap-2">
          <button onClick={leave} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="flex-1 text-center text-xs text-muted-foreground">
            {mode} · {liveRoom.format} · BO{liveRoom.best_of} · {legsToWin} leg
          </p>
          {done
            ? <Badge className="bg-[oklch(0.78_0.16_85)]/15 text-[oklch(0.78_0.16_85)] border-[oklch(0.78_0.16_85)]/30 text-xs">Дууссан</Badge>
            : <Badge className="bg-primary/15 text-primary border-primary/30 pulse-live text-xs">LIVE</Badge>}
        </div>

        {/* Winner banner */}
        {done && winnerTeam !== null && winnerTeam !== undefined && (
          <div className="text-center py-4 rounded-xl bg-[oklch(0.78_0.16_85)]/10 border border-[oklch(0.78_0.16_85)]/30">
            <div className="text-4xl mb-1">🏆</div>
            <p className="text-lg font-black text-[oklch(0.78_0.16_85)]">{bigName(winnerTeam)} хожлоо!</p>
            <p className="text-xs text-muted-foreground mt-0.5">{d.legs[0]} — {d.legs[1]}</p>
          </div>
        )}

        {/* TV scoreboard */}
        <div className="rounded-xl overflow-hidden border border-border/40">
          <div className="grid grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={cn("py-2.5 px-3 text-center min-w-0 transition-colors",
                !done && activeTeam === i
                  ? (i === 0 ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white")
                  : "bg-secondary/60 text-muted-foreground")}>
                <p className="text-base font-extrabold truncate leading-tight">{bigName(i)}</p>
                {subName(i) && <p className="text-[11px] opacity-80 truncate">{subName(i)}</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 bg-card">
            {[0, 1].map((i) => {
              const active = !done && activeTeam === i
              return (
                <div key={i} className={cn("flex items-center justify-center px-3 py-2 border-border/40",
                  i === 0 ? "border-r" : "", active ? "bg-foreground" : "")}>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-background shrink-0 mr-1.5" />}
                  <span className={cn("text-5xl font-black score-display leading-none",
                    active ? "text-background" : "text-foreground/55")}>{d.scores[i]}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-3 bg-secondary/40 py-1 text-xs">
            <span className={cn("font-black tabular-nums", activeTeam === 0 ? "text-primary" : "text-muted-foreground")}>{d.legs[0]}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Legs</span>
            <span className={cn("font-black tabular-nums", activeTeam === 1 ? "text-blue-400" : "text-muted-foreground")}>{d.legs[1]}</span>
          </div>
          <div className="py-2">
            {Array.from({ length: rowCount }).map((_, i) => {
              const isActiveRow = !done && i === activeRound - 1
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center">
                  {scoreCell(t0[i], 0)}
                  <div className="relative flex items-center justify-center w-12">
                    {isActiveRow && (
                      <span className={cn("absolute text-yellow-400 text-xs", activeTeam === 0 ? "-left-0.5" : "-right-0.5")}>
                        {activeTeam === 0 ? "◀" : "▶"}
                      </span>
                    )}
                    <span className="h-9 w-7 flex items-center justify-center text-sm font-bold bg-zinc-800 text-zinc-300">{i + 1}</span>
                  </div>
                  {scoreCell(t1[i], 1)}
                </div>
              )
            })}
          </div>
        </div>

        {/* Дууссан → буцах */}
        {done ? (
          <Link href="/play" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Тоглох хуудас руу</Link>
        ) : isMyTurn ? (
          <>
            {checkoutHint && !isBust && (
              <p className="text-center text-[11px] font-mono text-[oklch(0.78_0.16_85)] font-bold">🎯 {checkoutHint}</p>
            )}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-primary">Таны ээлж</span>
              <div className="flex items-center gap-2">
                {isBust && <Badge className="bg-destructive/15 text-destructive border-destructive/30">BUST</Badge>}
                {isCheckout && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">CHECKOUT</Badge>}
                {!isBust && !isCheckout && input !== "" && <span className="text-xs font-mono text-muted-foreground">→ {beforeActive - inputNum}</span>}
                <span className={cn("text-3xl font-black score-display tabular-nums w-16 text-right",
                  isBust ? "text-destructive" : isCheckout ? "text-green-400" : "")}>{input || "0"}</span>
              </div>
            </div>
            {isCheckout && <DartSelector value={dartsUsed} onChange={setDartsUsed} label="Хэдэн дартаар checkout хийв?" />}
            <div className="grid grid-cols-3 gap-2">
              {KEYPAD.flat().map((k, i) => (
                <button key={i} onClick={() => keypad(k)}
                  className={cn("h-12 rounded-xl text-lg font-bold transition-all active:scale-95",
                    k === "DEL" ? "bg-secondary/80 text-destructive" :
                    k === "*" ? "bg-secondary/80 text-muted-foreground" :
                    "bg-secondary/50 hover:bg-secondary border border-border/30")}>
                  {k === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : k === "*" ? "C" : k}
                </button>
              ))}
            </div>
            <button onClick={doSubmit} disabled={input === "" || submitting}
              className={cn("w-full py-3 rounded-xl font-bold transition-all disabled:opacity-40",
                isCheckout ? "bg-green-600 hover:bg-green-700 text-white" :
                isBust ? "bg-destructive text-white" : "bg-primary text-primary-foreground glow-primary")}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : isCheckout ? "✓ Checkout!" : isBust ? "Bust — ээлж алдах" : "Оруулах"}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{activeP?.profile?.display_name ?? "Өрсөлдөгч"}-ийн ээлжийг хүлээж байна…</span>
          </div>
        )}
      </div>
    )
  }

  // ── READY-UP LOBBY ────────────────────────────────────────
  function SlotCard({ team, slot }: { team: number; slot: number }) {
    const p = playerAt(team, slot)
    const inv = inviteAt(team, slot)
    if (p) {
      const tier = p.profile ? getTier(p.profile.rating_points) : null
      const mine = p.player_id === currentUserId
      return (
        <div className={cn("flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
          p.is_ready ? "border-green-500/40 bg-green-500/5" : mine ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/20")}>
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={p.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
              {(p.profile?.display_name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{p.profile?.display_name ?? "Тоглогч"}{mine && " (та)"}</p>
            {tier && <p className={cn("text-[11px] font-semibold", tier.color)}>{tier.tier} · {p.profile?.rating_points}</p>}
          </div>
          {p.is_ready
            ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] shrink-0"><Check className="h-3 w-3 mr-0.5" />Бэлэн</Badge>
            : <span className="text-[10px] text-muted-foreground shrink-0">Хүлээж байна</span>}
        </div>
      )
    }
    // Хоосон байр
    return (
      <div className="p-3 rounded-xl border-2 border-dashed border-border/50 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-xs">{inv ? `@${inv.profile?.username ?? "..."} уригдсан` : "Хоосон"}</span>
        </div>
        {isHost && !inv && (
          <AccountLinkPicker
            value={null}
            placeholder="@username урих"
            onChange={(a) => { if (a) invitePlayer(team, slot, a) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Онлайн тоглолт</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs border-border/60">{mode}</Badge>
            <Badge variant="outline" className="text-xs border-border/60">{liveRoom.format}</Badge>
            <Badge variant="outline" className="text-xs border-border/60">BO{liveRoom.best_of}</Badge>
            <Badge className="text-xs bg-yellow-500/15 text-yellow-400 border-yellow-500/30 pulse-live">
              Хүлээж байна {filled}/{need}
            </Badge>
          </div>
        </div>
      </div>

      {/* Урилга — уригдсан ч ороогүй */}
      {invite && !me && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm"><strong>{hostName}</strong> таныг Баг {invite.team + 1}-д урьж байна.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => respondInvite("decline")} disabled={busy}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm disabled:opacity-40">
                <X className="h-4 w-4" /> Татгалзах
              </button>
              <button onClick={() => respondInvite("accept")} disabled={busy}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold glow-primary text-sm disabled:opacity-40">
                <Check className="h-4 w-4" /> Нэгдэх
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Өрөөний код */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Өрөөний код</p>
            <p className="font-mono text-2xl font-black tracking-widest">{liveRoom.room_code}</p>
          </div>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs hover:bg-secondary transition-colors">
            <Copy className="h-3.5 w-3.5" /> Хуулах
          </button>
        </CardContent>
      </Card>

      {/* Багууд */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((team) => (
          <div key={team} className="space-y-2">
            <p className={cn("text-sm font-bold text-center", team === 0 ? "text-primary" : "text-blue-400")}>
              Баг {team + 1}
            </p>
            {Array.from({ length: n }).map((_, slot) => (
              <SlotCard key={slot} team={team} slot={slot} />
            ))}
          </div>
        ))}
      </div>

      {/* Миний удирдлага */}
      {me && (
        <div className="flex items-center gap-3">
          <button onClick={leave} disabled={busy}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-border/60 text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-40">
            <LogOut className="h-4 w-4" /> Гарах
          </button>
          <button onClick={toggleReady} disabled={busy}
            className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-40",
              me.is_ready
                ? "border-2 border-green-500/40 text-green-400 bg-green-500/5"
                : "bg-primary text-primary-foreground glow-primary")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {me.is_ready ? "Бэлэн боллоо ✓" : "Бэлэн"}
          </button>
        </div>
      )}
      {me && filled < need && (
        <p className="text-[11px] text-center text-muted-foreground">
          Бүх тоглогч ({need}) нэгдэж бэлэн болоход тоглолт автоматаар эхэлнэ.
        </p>
      )}
    </div>
  )
}
