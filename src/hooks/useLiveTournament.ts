"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface LiveMatch {
  id: string
  player1_id: string
  player2_id: string | null
  player1_legs: number
  player2_legs: number
  winner_id: string | null
  status: string
}

interface LiveRegistration {
  player_id: string
  payment_status: string
}

export function useLiveTournament(tournamentId: string) {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [registrations, setRegistrations] = useState<LiveRegistration[]>([])
  const [isLive, setIsLive] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const [matchesRes, regsRes] = await Promise.all([
      supabase.from("matches").select("id,player1_id,player2_id,player1_legs,player2_legs,winner_id,status")
        .eq("tournament_id", tournamentId),
      supabase.from("tournament_registrations").select("player_id,payment_status")
        .eq("tournament_id", tournamentId),
    ])
    if (matchesRes.data) setMatches(matchesRes.data)
    if (regsRes.data) {
      setRegistrations(regsRes.data)
      setPlayerCount(regsRes.data.length)
    }
  }, [tournamentId])

  useEffect(() => {
    fetchData()

    // Realtime subscription for matches
    const matchChannel = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `tournament_id=eq.${tournamentId}`,
      }, (payload) => {
        setIsLive(true)
        if (payload.eventType === "UPDATE") {
          setMatches((prev) => prev.map((m) =>
            m.id === (payload.new as LiveMatch).id ? (payload.new as LiveMatch) : m
          ))
        } else if (payload.eventType === "INSERT") {
          setMatches((prev) => [...prev, payload.new as LiveMatch])
        }
      })
      .subscribe()

    // Realtime subscription for registrations
    const regChannel = supabase
      .channel(`tournament-regs-${tournamentId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tournament_registrations",
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(matchChannel)
      supabase.removeChannel(regChannel)
    }
  }, [tournamentId])

  const ongoingMatches = matches.filter((m) => m.status === "ongoing")
  const completedMatches = matches.filter((m) => m.status === "completed")

  return { matches, registrations, playerCount, isLive, ongoingMatches, completedMatches }
}
