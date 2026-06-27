import { createClient } from "@/lib/supabase/client"
import type { LocalSession } from "./types"

// Supabase typed client-г bypass хийж local_session_sync ашиглана
function db() {
  return createClient() as any
}

// Realtime broadcast-д зориулсан channel-уудыг дахин ашиглах
const senderChannels = new Map<string, any>()

function getSenderChannel(sessionId: string) {
  if (!senderChannels.has(sessionId)) {
    const ch = (createClient() as any).channel(`ls-${sessionId}`)
    ch.subscribe()
    senderChannels.set(sessionId, ch)
  }
  return senderChannels.get(sessionId)
}

// Session state-г Supabase-д broadcast хийх
export async function broadcastSession(session: LocalSession) {
  // 1. DB upsert — persistence + postgres_changes fallback
  try {
    await db().from("local_session_sync").upsert({
      session_id: session.id,
      data: session,
      updated_at: new Date().toISOString(),
    })
  } catch {}

  // 2. Realtime broadcast — шууд бүх subscriber-д хүргэнэ
  try {
    const ch = getSenderChannel(session.id)
    await ch.send({ type: "broadcast", event: "session", payload: { session } })
  } catch {}
}

// Supabase-с session state татах — шууд fetch, cache: no-store
export async function fetchRemoteSession(sessionId: string): Promise<LocalSession | null> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/local_session_sync?session_id=eq.${encodeURIComponent(sessionId)}&select=data&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    const rows: { data: LocalSession }[] = await res.json()
    return rows[0]?.data ?? null
  } catch {
    return null
  }
}

// Supabase-с session устгах
export async function deleteRemoteSession(sessionId: string) {
  try {
    await db().from("local_session_sync").delete().eq("session_id", sessionId)
  } catch {}
}

// joinCode-оор session хайх (нууц үгтэй эсэхээс үл хамааран)
export async function fetchSessionByJoinCode(joinCode: string): Promise<LocalSession | null> {
  try {
    const { data } = await db()
      .from("local_session_sync")
      .select("data")
      .eq("data->>joinCode", joinCode.toUpperCase())
      .maybeSingle()
    return (data?.data as LocalSession) ?? null
  } catch {
    return null
  }
}

// Нээлттэй (нууц үггүй) active session-уудыг татах
export async function fetchPublicSessions(): Promise<LocalSession[]> {
  try {
    const { data } = await db()
      .from("local_session_sync")
      .select("data, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30)
    if (!data) return []
    return (data as any[])
      .map((row: any) => row.data as LocalSession)
      .filter((s) => !s.joinPassword && s.status !== "completed")
  } catch {
    return []
  }
}

// Нээлттэй session-уудын realtime subscription
export function subscribeToPublicSessions(onUpdate: (sessions: LocalSession[]) => void) {
  const supabase = createClient() as any
  const channel = supabase
    .channel("public-local-sessions")
    .on("postgres_changes", { event: "*", schema: "public", table: "local_session_sync" }, async () => {
      const sessions = await fetchPublicSessions()
      onUpdate(sessions)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// Realtime subscription — LiveView ашиглана
// Filtered postgres_changes: тухайн session row update болоход шууд мэдэгдэнэ
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: LocalSession) => void
) {
  const supabase = createClient() as any
  const channel = supabase
    .channel(`live-${sessionId}-${Date.now()}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "local_session_sync",
      filter: `session_id=eq.${sessionId}`,
    }, (payload: any) => {
      const s = payload.new?.data as LocalSession
      if (s) onUpdate(s)
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
