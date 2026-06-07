"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Send, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { formatRelativeTime } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { PlayerName } from "@/components/cosmetic/PlayerName"

interface Sender {
  display_name: string
  username: string
  avatar_url: string | null
  equipped_frame?: string | null
  name_effect?: string | null
  name_color?: string | null
  name_font?: string | null
  name_animated?: boolean | null
}
interface Msg {
  id: string
  player_id: string
  body: string
  created_at: string
  sender: Sender | null
}

interface Props {
  clubId: string
  currentUserId: string
}

export function ClubChat({ clubId, currentUserId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const supabase = createClient()
  const cacheRef = useRef<Map<string, Sender>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const { data: rows } = await supabase
        .from("club_messages")
        .select("id, player_id, body, created_at")
        .eq("club_id", clubId)
        .order("created_at", { ascending: true })
        .limit(100)

      if (!active) return

      // Илгээгчдийн профайлыг тусад нь татах
      const ids = [...new Set((rows ?? []).map((r) => r.player_id))]
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name, username, avatar_url, equipped_frame, name_effect, name_color, name_font, name_animated").in("id", ids)
        : { data: [] }
      for (const p of profs ?? []) {
        cacheRef.current.set(p.id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url })
      }

      if (!active) return
      const msgs: Msg[] = (rows ?? []).map((r) => ({
        id: r.id, player_id: r.player_id, body: r.body, created_at: r.created_at,
        sender: cacheRef.current.get(r.player_id) ?? null,
      }))
      setMessages(msgs)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`club-chat-${clubId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "club_messages",
        filter: `club_id=eq.${clubId}`,
      }, async (payload) => {
        const row = payload.new as { id: string; player_id: string; body: string; created_at: string }
        let sender = cacheRef.current.get(row.player_id) ?? null
        if (!sender) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url, equipped_frame, name_effect, name_color, name_font, name_animated")
            .eq("id", row.player_id)
            .single()
          sender = prof ?? null
          if (prof) cacheRef.current.set(row.player_id, prof)
        }
        setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, sender }])
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [clubId])

  // Шинэ мессеж ирэхэд доош гүйлгэх
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput("")
    const { error } = await supabase.from("club_messages").insert({
      club_id: clubId,
      player_id: currentUserId,
      body: text,
    })
    if (error) {
      toast.error("Илгээхэд алдаа гарлаа")
      setInput(text)
    }
    setSending(false)
  }

  return (
    <Card className="border-border/50 bg-card/80 flex flex-col h-[480px]">
      {/* Мессежүүд */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Мессеж байхгүй байна</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Эхний мессежийг бичээрэй!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.player_id === currentUserId
            return (
              <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={m.sender?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-secondary">
                    {(m.sender?.display_name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("min-w-0 max-w-[75%]", mine && "items-end flex flex-col")}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{mine ? "Та" : (m.sender ? <PlayerName p={m.sender} /> : "?")}</span>
                    <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(m.created_at)}</span>
                  </div>
                  <div className={cn(
                    "mt-0.5 rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap",
                    mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary rounded-tl-sm"
                  )}>
                    {m.body}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Бичих хэсэг */}
      <div className="border-t border-border/40 p-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Мессеж бичих..."
          maxLength={2000}
          className="flex-1 rounded-full bg-secondary/50 border border-border/60 px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </Card>
  )
}
