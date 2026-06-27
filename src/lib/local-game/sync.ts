import { createClient } from "@/lib/supabase/client"
import type { LocalSession } from "./types"

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Session state-г Supabase-д шууд fetch-ээр upsert хийх
export async function broadcastSession(session: LocalSession) {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/local_session_sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        session_id: session.id,
        data: session,
        updated_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) {
      console.error("[broadcastSession] upsert failed:", res.status, await res.text())
    }
  } catch (e) {
    console.error("[broadcastSession] fetch error:", e)
  }
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

const HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
}

// Supabase-с session устгах
export async function deleteRemoteSession(sessionId: string) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/local_session_sync?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: HEADERS,
    })
  } catch {}
}

// joinCode-оор session хайх
export async function fetchSessionByJoinCode(joinCode: string): Promise<LocalSession | null> {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/local_session_sync?data->>joinCode=eq.${encodeURIComponent(joinCode.toUpperCase())}&select=data&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    )
    if (!res.ok) return null
    const rows: { data: LocalSession }[] = await res.json()
    return rows[0]?.data ?? null
  } catch {
    return null
  }
}

// Нээлттэй (нууц үггүй) active session-уудыг татах
export async function fetchPublicSessions(): Promise<LocalSession[]> {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/local_session_sync?select=data,updated_at&order=updated_at.desc&limit=30`,
      { headers: HEADERS, cache: "no-store" }
    )
    if (!res.ok) return []
    const rows: { data: LocalSession }[] = await res.json()
    return rows.map((r) => r.data).filter((s) => !s.joinPassword && s.status !== "completed")
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
