"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useLocalGame } from "@/lib/local-game/store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const { sessionId } = useParams<{ sessionId: string }>()
  const session = useLocalGame((s) => s.sessions[sessionId])
  const [mounted, setMounted] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Нууц үгтэй бол sessionStorage шалгана
    const key = `local-session-unlocked-${sessionId}`
    if (!session?.joinPassword || sessionStorage.getItem(key) === "1") {
      setUnlocked(true)
    }
  }, [sessionId, session])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === session?.joinPassword) {
      sessionStorage.setItem(`local-session-unlocked-${sessionId}`, "1")
      setUnlocked(true)
    } else {
      setError(true)
      setInput("")
    }
  }

  // SSR болон mount хүлээнэ
  if (!mounted) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  // Нууц үгтэй, нэвтрээгүй бол gate харуулна
  if (session?.joinPassword && !unlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
            </div>
            <h2 className="text-xl font-bold">{session.name}</h2>
            <p className="text-sm text-muted-foreground">
              Нууц үгтэй хамгаалагдсан тэмцээн
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Нууц үг</Label>
              <Input
                id="pw"
                type="password"
                placeholder="Нууц үг оруулна уу"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(false) }}
                className={cn("bg-secondary/50", error && "border-destructive")}
                autoFocus
              />
              {error && <p className="text-xs text-destructive">Нууц үг буруу байна</p>}
            </div>
            <Button type="submit" className="w-full glow-primary" disabled={!input}>
              Нэвтрэх
            </Button>
          </form>

          <div className="text-center">
            <Link href="/local" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />Буцах
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
