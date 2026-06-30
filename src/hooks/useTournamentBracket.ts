"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export interface BracketMatch {
  id: string
  round: number
  match_number: number
  is_losers_bracket: boolean
  group_no: number | null
  side1_entrant_id: string | null
  side2_entrant_id: string | null
  side1_legs: number
  side2_legs: number
  winner_entrant_id: string | null
  loser_entrant_id: string | null
  status: "pending" | "ongoing" | "completed"
  next_match_id: string | null
  room_id: string | null
  stage_id: string | null
}

export interface BracketEntrant {
  id: string
  display_name: string
  seed: number
  group_no: number | null
}

// Online тэмцээний bracket-г татаж, tournament_matches-д realtime subscribe хийнэ.
// Match цөөн тул өөрчлөлт бүрт бүтнээр дахин татна (энгийн, найдвартай).
export function useTournamentBracket(tournamentId: string) {
  const [matches, setMatches] = useState<BracketMatch[]>([])
  const [entrants, setEntrants] = useState<Record<string, BracketEntrant>>({})
  // player_id → entrant_id (одоогийн хэрэглэгч уг match-ийн оролцогч эсэхийг мэдэхэд)
  const [playerEntrant, setPlayerEntrant] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [mRes, eRes] = await Promise.all([
      supabase.from("tournament_matches")
        .select("id,round,match_number,is_losers_bracket,group_no,side1_entrant_id,side2_entrant_id,side1_legs,side2_legs,winner_entrant_id,loser_entrant_id,status,next_match_id,room_id,stage_id")
        .eq("tournament_id", tournamentId)
        .order("round").order("match_number"),
      supabase.from("tournament_entrants")
        .select("id,display_name,seed,group_no")
        .eq("tournament_id", tournamentId),
    ])
    if (mRes.data) setMatches(mRes.data as BracketMatch[])
    if (eRes.data) {
      const map: Record<string, BracketEntrant> = {}
      for (const e of eRes.data as BracketEntrant[]) map[e.id] = e
      setEntrants(map)
      const entIds = (eRes.data as BracketEntrant[]).map((e) => e.id)
      if (entIds.length) {
        const { data: eps } = await supabase.from("tournament_entrant_players")
          .select("entrant_id,player_id").in("entrant_id", entIds)
        const pe: Record<string, string> = {}
        for (const ep of (eps ?? []) as { entrant_id: string; player_id: string }[]) pe[ep.player_id] = ep.entrant_id
        setPlayerEntrant(pe)
      }
    }
    setLoading(false)
  }, [tournamentId])

  useEffect(() => {
    // setState нь await-ийн дараа (синхрон биш) — fetch-based sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
    const supabase = createClient()
    const ch = supabase
      .channel(`tournament-bracket-${tournamentId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tournament_matches",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { fetchData() })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tournament_entrants",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { fetchData() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tournamentId, fetchData])

  const ongoingCount = matches.filter((m) => m.status === "ongoing").length
  return { matches, entrants, playerEntrant, loading, ongoingCount, refetch: fetchData }
}
