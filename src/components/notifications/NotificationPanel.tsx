"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, CheckCheck, Loader2, Trophy, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatRelativeTime } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  icon: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

interface Props {
  userId: string
}

export function NotificationPanel({ userId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function fetchNotifications() {
    setLoading(true)
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifications()

    // Realtime subscription
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false)
  }

  function handleNotificationClick(n: Notification) {
    markRead(n.id)
    if (n.link) { router.push(n.link); setOpen(false) }
  }

  const typeColors: Record<string, string> = {
    achievement_earned: "text-yellow-400 bg-yellow-400/10",
    tournament_registered: "text-blue-400 bg-blue-400/10",
    match_completed: "text-green-400 bg-green-400/10",
    rating_changed: "text-primary bg-primary/10",
    system: "text-muted-foreground bg-secondary",
    tournament_starting: "text-primary bg-primary/10",
    club_joined: "text-purple-400 bg-purple-400/10",
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Мэдэгдэл</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-primary/15 text-primary rounded-full px-1.5 py-0.5">
                  {unreadCount} шинэ
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <CheckCheck className="h-3 w-3" /> Бүгдийг уншсан
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Мэдэгдэл байхгүй байна</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border/20 last:border-0 transition-colors hover:bg-secondary/40",
                    !n.is_read && "bg-primary/3"
                  )}>
                  {/* Icon */}
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5",
                    typeColors[n.type] ?? "text-muted-foreground bg-secondary"
                  )}>
                    {n.icon ?? "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", !n.is_read ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{formatRelativeTime(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
