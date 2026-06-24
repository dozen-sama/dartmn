"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CameraSetup } from "@/components/play/CameraSetup"
import { PerDartScoreboard } from "@/components/game/PerDartScoreboard"

function CameraGameContent() {
  const router = useRouter()
  const params = useSearchParams()
  const p1 = params.get("p1") ?? "Тоглогч 1"
  const p2 = params.get("p2") ?? "Тоглогч 2"
  const start = parseInt(params.get("start") ?? "501")
  const legs = parseInt(params.get("legs") ?? "3")
  const doubleOut = params.get("double") !== "0"

  const [phase, setPhase] = useState<"setup" | "game">("setup")

  useEffect(() => {
    // If already set up in this session, skip setup
    if (sessionStorage.getItem("cam-ready") === "1") setPhase("game")
  }, [])

  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <CameraSetup
          onConfirmed={() => setPhase("game")}
          onBack={() => router.back()}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <PerDartScoreboard
        player1Name={p1}
        player2Name={p2}
        startScore={start}
        legsToWin={legs}
        doubleOut={doubleOut}
        onWinner={() => {}}
        onBack={() => {
          sessionStorage.removeItem("cam-ready")
          router.back()
        }}
      />
    </div>
  )
}

export default function CameraGamePage() {
  return (
    <Suspense>
      <CameraGameContent />
    </Suspense>
  )
}
