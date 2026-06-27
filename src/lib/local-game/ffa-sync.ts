import { createClient } from "@/lib/supabase/client"
import type { FFAGame } from "./ffa-types"

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const HEADERS = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }

export async function broadcastFFA(game: FFAGame) {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/local_session_sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...HEADERS,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ session_id: game.id, data: game, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) console.error("[broadcastFFA]", res.status, await res.text())
  } catch (e) { console.error("[broadcastFFA]", e) }
}

export async function fetchRemoteFFA(gameId: string): Promise<FFAGame | null> {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/local_session_sync?session_id=eq.${encodeURIComponent(gameId)}&select=data&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    )
    if (!res.ok) return null
    const rows: { data: FFAGame }[] = await res.json()
    const d = rows[0]?.data
    return d?.type === "freeforall" ? d : null
  } catch { return null }
}

export function subscribeToFFA(gameId: string, onUpdate: (game: FFAGame) => void) {
  const supabase = createClient() as any
  const channel = supabase
    .channel(`ffa-${gameId}-${Date.now()}`)
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "local_session_sync",
      filter: `session_id=eq.${gameId}`,
    }, (payload: any) => {
      const g = payload.new?.data as FFAGame
      if (g?.type === "freeforall") onUpdate(g)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
