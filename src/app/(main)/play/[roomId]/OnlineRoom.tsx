"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Clock, Copy, Loader2, Users, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { getTier } from "@/lib/rating"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  rating_points: number
}

interface RoomData {
  id: string
  room_code: string
  host_id: string
  guest_id: string | null
  format: string
  best_of: number
  status: string
  host: Profile | null
  guest: Profile | null
}

interface Props {
  room: RoomData
  currentUserId: string
  currentProfile: Profile
}

export function OnlineRoom({ room, currentUserId, currentProfile }: Props) {
  const router = useRouter()
  const [liveRoom, setLiveRoom] = useState(room)
  const supabase = createClient()

  const isHost = currentUserId === room.host_id
  const opponent = isHost ? liveRoom.guest : liveRoom.host
  const isWaiting = !liveRoom.guest_id || liveRoom.status === "waiting"

  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "online_rooms",
        filter: `id=eq.${room.id}`,
      }, async (payload) => {
        const updated = payload.new as any
        if (updated.guest_id && !liveRoom.guest) {
          // Fetch guest profile
          const { data: guest } = await supabase.from("profiles")
            .select("id, display_name, username, avatar_url, rating_points")
            .eq("id", updated.guest_id).single()
          setLiveRoom((prev) => ({ ...prev, ...updated, guest }))
          toast.success("Өрсөлдөгч нэгдлээ!")
        } else {
          setLiveRoom((prev) => ({ ...prev, ...updated }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id])

  function copyCode() {
    navigator.clipboard.writeText(room.room_code)
    toast.success("Код хуулагдлаа")
  }

  function PlayerSlot({ profile, label, isMe }: { profile: Profile | null; label: string; isMe: boolean }) {
    if (!profile) {
      return (
        <div className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border/50">
          <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Хүлээж байна...</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )
    }

    const tier = getTier(profile.rating_points)
    return (
      <div className={cn("flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
        isMe ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/20")}>
        <div className="relative">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl">
              {profile.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isMe && <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-background" />}
        </div>
        <div className="text-center">
          <p className="font-bold">{profile.display_name}</p>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
          <p className={cn("text-xs font-semibold mt-1", tier.color)}>{tier.icon} {tier.tier}</p>
          <p className="text-xs text-muted-foreground">{profile.rating_points} pts</p>
        </div>
        {isMe && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Та</Badge>}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Онлайн тоглолт</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs border-border/60">{liveRoom.format}</Badge>
            <Badge variant="outline" className="text-xs border-border/60">BO{liveRoom.best_of}</Badge>
            {isWaiting ? (
              <Badge className="text-xs bg-yellow-500/15 text-yellow-400 border-yellow-500/30 pulse-live">Хүлээж байна</Badge>
            ) : (
              <Badge className="text-xs bg-primary/15 text-primary border-primary/30 pulse-live">LIVE</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Room code */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Өрөөний код</p>
            <p className="font-mono text-2xl font-black tracking-widest">{room.room_code}</p>
          </div>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs hover:bg-secondary transition-colors">
            <Copy className="h-3.5 w-3.5" />
            Хуулах
          </button>
        </CardContent>
      </Card>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        <PlayerSlot profile={liveRoom.host} label="Host" isMe={isHost} />
        <PlayerSlot profile={liveRoom.guest} label="Guest" isMe={!isHost} />
      </div>

      {/* VS divider */}
      <div className="text-center">
        <span className="text-2xl font-black text-muted-foreground/30">VS</span>
      </div>

      {/* Waiting state */}
      {isWaiting && isHost && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400">Өрсөлдөгч хүлээж байна</p>
              <p className="text-xs text-muted-foreground mt-1">
                Дээрх <strong className="text-foreground">{room.room_code}</strong> кодыг найздаа илгээгээрэй.
                Нэгдсэний дараа тоглолт эхэлнэ.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game started */}
      {!isWaiting && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Тоглолт эхэлсэн!
            </p>
            <p className="text-xs text-muted-foreground">
              Одоогоор оноо автоматаар бүртгэгдэхгүй байна. Тоглогч бүр зөвшилцөн оноо оруулна.
              Ирээдүйд e-dart board болон камерийн дэмжлэг нэмэгдэх болно.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center bg-secondary/40 rounded-lg py-4">
                <p className="text-3xl font-black text-primary score-display">{liveRoom.format}</p>
                <p className="text-xs text-muted-foreground mt-1">Таны оноо</p>
              </div>
              <div className="text-center bg-secondary/40 rounded-lg py-4">
                <p className="text-3xl font-black score-display">{liveRoom.format}</p>
                <p className="text-xs text-muted-foreground mt-1">Өрсөлдөгч</p>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground/60">
              Камерийн дэмжлэг нэмэгдэхэд автомат оноо бүртгэгдэнэ
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
