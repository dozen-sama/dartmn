"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { fetchSessionByJoinCode } from "@/lib/local-game/sync"
import { useLocalGame } from "@/lib/local-game/store"

export default function JoinByCode() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const sessions = useLocalGame((s) => s.sessions)
  const [status, setStatus] = useState<"searching" | "notfound">("searching")

  useEffect(() => {
    async function find() {
      // 1. Local Zustand-аас хайна (өмнө нь оролцсон бол)
      const local = Object.values(sessions).find(
        (s) => s.joinCode?.toUpperCase() === code.toUpperCase()
      )
      if (local) { router.replace(`/local/${local.id}`); return }

      // 2. Supabase-с joinCode-оор шууд хайна
      const found = await fetchSessionByJoinCode(code)
      if (found) { router.replace(`/local/${found.id}`); return }

      setStatus("notfound")
    }
    find()
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin h-7 w-7 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">Тэмцээн хайж байна…</p>
        <p className="text-xs text-muted-foreground/50 font-mono">{code}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <p className="text-lg font-bold">Тэмцээн олдсонгүй</p>
      <p className="text-sm text-muted-foreground text-center">
        <span className="font-mono font-bold">{code}</span> кодтой тэмцээн байхгүй эсвэл дууссан байна.
      </p>
      <Link href="/local" className="text-sm text-primary hover:underline">
        Тэмцээнүүд руу буцах
      </Link>
    </div>
  )
}
