"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, X, Trophy, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export interface TeamView { name: string; players: string[]; isWinner: boolean }

interface Props {
  id: string
  status: string
  canConfirm: boolean
  reporterName: string
  teams: TeamView[]
}

export function ConfirmResult({ id, status, canConfirm, reporterName, teams }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(
    status === "confirmed" ? "confirmed" : status === "rejected" ? "rejected" : null
  )

  // 1 хүнтэй баг → тоглогчийн нэр гарчиг болно, олонтой бол багийн нэр + гишүүд
  const heading = (t: TeamView) => t.players.length === 1 ? t.players[0] : t.name
  const sub = (t: TeamView) => t.players.length === 1 ? null : t.players.join(", ")
  const winner = teams.find((t) => t.isWinner)

  async function act(action: "confirm" | "reject") {
    setBusy(true)
    const res = await fetch("/api/play/confirm-result", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      if (action === "confirm") {
        // Баталгаажуулсан даруйд шууд тоглох хуудас (lobby) руу үсэрнэ
        toast.success("Баталгаажлаа — ELO шинэчлэгдлээ")
        router.push("/play")
        return
      }
      setDone("rejected")
      toast.success("Татгалзлаа")
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? "Алдаа гарлаа")
    }
    setBusy(false)
  }

  return (
    <div className="max-w-sm mx-auto space-y-5 py-6">
      <div className="text-center space-y-1">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-xl font-bold">Тоглолтын үр дүн баталгаажуулах</h1>
        <p className="text-sm text-muted-foreground">{reporterName} тоглолтын үр дүнг бүртгэлээ</p>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-stretch justify-center gap-3 text-center">
            {teams.map((t, i) => (
              <div key={i} className="contents">
                {i > 0 && <span className="self-center text-xs text-muted-foreground/50 font-black">VS</span>}
                <div className={cn("flex-1 min-w-0 rounded-lg p-2",
                  t.isWinner ? "bg-[oklch(0.78_0.16_85)]/10" : "")}>
                  <p className="font-bold truncate">{heading(t)}</p>
                  {sub(t) && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub(t)}</p>}
                </div>
              </div>
            ))}
          </div>
          {winner && (
            <div className="flex items-center justify-center gap-2 bg-secondary/40 rounded-lg py-2.5">
              <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
              <span className="text-sm">Ялагч: <strong>{heading(winner)}</strong></span>
            </div>
          )}
          {canConfirm && !done && (
            <p className="text-xs text-center text-muted-foreground">
              Энэ үр дүн зөв бол баталгаажуул. Зөв бол л бүх тоглогчийн ELO/статистик шинэчлэгдэнэ.
            </p>
          )}
        </CardContent>
      </Card>

      {done ? (
        <div className={cn("text-center py-3 rounded-xl font-semibold",
          done === "confirmed" ? "bg-green-500/15 text-green-400" : "bg-destructive/10 text-destructive")}>
          {done === "confirmed" ? "✓ Баталгаажсан" : "✕ Татгалзсан"}
        </div>
      ) : canConfirm ? (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => act("reject")} disabled={busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-medium disabled:opacity-40">
            <X className="h-4 w-4" /> Татгалзах
          </button>
          <button onClick={() => act("confirm")} disabled={busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold glow-primary disabled:opacity-40">
            <Check className="h-4 w-4" /> Баталгаажуулах
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Эсрэг багийн баталгаажуулахыг хүлээж байна.
        </p>
      )}

      <div className="text-center">
        <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
          Тоглох хуудас руу
        </Link>
      </div>
    </div>
  )
}
