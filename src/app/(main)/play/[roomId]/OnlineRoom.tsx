"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, Copy, Loader2, LogOut, Users, X, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AccountLinkPicker, type LinkedAccount } from "@/components/game/AccountLinkPicker"
import { createClient } from "@/lib/supabase/client"
import { getTier } from "@/lib/rating"
import { teamSize, totalPlayers, type RoomMode } from "@/lib/local-game/room"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import type { OnlineRoom as Room } from "@/types/database"

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
  const supabase = createClient()
  const [liveRoom, setLiveRoom] = useState<Room>(room)
  const [livePlayers, setLivePlayers] = useState<RoomPlayerView[]>(players)
  const [invites, setInvites] = useState<InviteView[]>([])
  const [invite, setInvite] = useState<MyInvite | null>(myInvite)
  const [busy, setBusy] = useState(false)
  const joinedRef = useRef(false)

  const mode = liveRoom.mode as RoomMode
  const n = teamSize(mode)
  const me = livePlayers.find((p) => p.player_id === currentUserId) ?? null
  const isHost = liveRoom.host_id === currentUserId

  // Бүх төлвийг сэргээнэ (realtime өөрчлөлт бүрд)
  const refresh = useCallback(async () => {
    const { data: r } = await supabase.from("online_rooms").select("*").eq("id", room.id).maybeSingle()
    if (r) setLiveRoom(r)
    const { data: rp } = await supabase.from("room_players").select("*").eq("room_id", room.id)
    const { data: inv } = await supabase.from("room_invites")
      .select("id, invitee_id, team, slot, status").eq("room_id", room.id).eq("status", "pending")
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

  // Realtime — өрөө, тоглогчид, урилгууд
  useEffect(() => {
    const ch = supabase.channel(`room-${room.id}`)
    for (const table of ["online_rooms", "room_players", "room_invites"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table,
        filter: table === "online_rooms" ? `id=eq.${room.id}` : `room_id=eq.${room.id}` },
        () => { refresh() })
    }
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id, refresh, supabase])

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
    await post(`/api/play/room/${room.id}/ready`, { ready: !me.is_ready })
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

  const filled = livePlayers.length
  const need = totalPlayers(mode)
  const playerAt = (team: number, slot: number) => livePlayers.find((p) => p.team === team && p.slot === slot)
  const inviteAt = (team: number, slot: number) => invites.find((i) => i.team === team && i.slot === slot)

  // ── GAME PHASE (Phase B-д бодит самбар) ───────────────────
  if (liveRoom.status === "ongoing") {
    return (
      <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <Zap className="h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">Тоглолт эхэллээ!</h1>
        <p className="text-sm text-muted-foreground">
          Онооны самбар удахгүй нэмэгдэнэ. ({mode} · {liveRoom.format} · BO{liveRoom.best_of})
        </p>
        <Link href="/play" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Тоглох хуудас</Link>
      </div>
    )
  }
  if (liveRoom.status === "completed") {
    return (
      <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="text-5xl">🏆</div>
        <h1 className="text-xl font-bold">Тоглолт дууссан</h1>
        <Link href="/play" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Тоглох хуудас</Link>
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
