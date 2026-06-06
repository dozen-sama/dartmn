import { createClient } from "@/lib/supabase/client"
import type { LocalSession } from "./types"

// Supabase typed client-г bypass хийж local_session_sync ашиглана
function db() {
  return createClient() as any
}

// Session state-г Supabase-д broadcast хийх
export async function broadcastSession(session: LocalSession) {
  try {
    await db().from("local_session_sync").upsert({
      session_id: session.id,
      data: session,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Network error тохиолдолд дуугүй — offline тоглолтыг хаахгүй
  }
}

// Supabase-с session state татах (spectator)
export async function fetchRemoteSession(sessionId: string): Promise<LocalSession | null> {
  try {
    const { data } = await db()
      .from("local_session_sync")
      .select("data")
      .eq("session_id", sessionId)
      .single()
    return (data?.data as LocalSession) ?? null
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
export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: LocalSession) => void
) {
  const supabase = createClient()
  const channel = supabase
    .channel(`local-session-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "local_session_sync",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const session = (payload.new as any)?.data as LocalSession
        if (session) onUpdate(session)
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
