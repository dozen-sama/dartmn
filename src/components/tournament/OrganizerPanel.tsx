"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2, Edit2, GripVertical, Loader2,
  Play, RefreshCw, Settings2, Trophy, UserMinus, Users, XCircle,
} from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { Tournament, TournamentRegistration, Profile } from "@/types/database"
import { formatCurrency } from "@/lib/utils/format"
import { mn } from "@/locales/mn"

type Reg = TournamentRegistration & {
  profiles: Pick<Profile, "id" | "display_name" | "username" | "avatar_url" | "rating_points"> | null
}

interface Props {
  tournament: Tournament
  registrations: Reg[]
}

const STATUS_FLOW: { from: Tournament["status"]; to: Tournament["status"]; label: string; color: string }[] = [
  { from: "draft", to: "registration", label: "Бүртгэл нээх", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { from: "registration", to: "ongoing", label: "Тэмцээн эхлүүлэх", color: "bg-primary/15 text-primary border-primary/30" },
  { from: "ongoing", to: "completed", label: "Тэмцээн дуусгах", color: "bg-green-500/15 text-green-400 border-green-500/30" },
]

export function OrganizerPanel({ tournament, registrations }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [regs, setRegs] = useState(registrations)
  const [bylStep, setBylStep] = useState<"idle" | "loading" | "waiting" | "checking">("idle")
  const [bylTxnId, setBylTxnId] = useState<string | null>(null)
  const [feePaid, setFeePaid] = useState(tournament.platform_fee_paid)
  const [seeds, setSeeds] = useState<Record<string, number>>(
    Object.fromEntries(registrations.map((r) => [r.player_id, r.seed ?? 0]))
  )

  const nextStatus = STATUS_FLOW.find((s) => s.from === tournament.status)

  // Оролцогчдын шагнал авах данс (зөвхөн зохион байгуулагч уншина — RLS)
  const [payouts, setPayouts] = useState<{ player_id: string; bank_name: string; account_number: string; account_holder: string; iban: string | null; name: string }[]>([])
  useEffect(() => {
    if (tournament.entry_fee <= 0) return
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.from("tournament_payout_accounts")
        .select("player_id, bank_name, account_number, account_holder, iban")
        .eq("tournament_id", tournament.id)
      if (!data || data.length === 0) { setPayouts([]); return }
      const ids = data.map((d) => d.player_id)
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids)
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name || p.username]))
      setPayouts(data.map((d) => ({ ...d, name: nameById.get(d.player_id) ?? "?" })))
    })()
  }, [tournament.id, tournament.entry_fee])

  async function createBylInvoice() {
    setBylStep("loading")
    try {
      const res = await fetch("/api/payments/byl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: tournament.id,
          player_id: tournament.organizer_id,
          amount: tournament.platform_fee,
          purpose: "platform_fee",
        }),
      })
      const data = await res.json()
      if (data.payment_url) {
        setBylTxnId(data.transaction_id)
        setBylStep("waiting")
        window.open(data.payment_url, "_blank", "noopener,noreferrer")
      } else {
        toast.error(data.error ?? "Төлбөрийн холболт амжилтгүй болоо")
        setBylStep("idle")
      }
    } catch {
      toast.error("Төлбөрийн холболт амжилтгүй болоо")
      setBylStep("idle")
    }
  }

  async function checkBylAndStart() {
    if (!bylTxnId) return
    setBylStep("checking")
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", bylTxnId)
      .single()
    if (data?.status === "paid") {
      setFeePaid(true)
      setBylStep("idle")
      toast.success("Шимтгэл төлөгдлөө — тэмцааныг эхлүүлж байна...")
      await doStart()
    } else {
      toast.info("Төлбөр хүлээгдэж байна...")
      setBylStep("waiting")
    }
  }

  async function doStart() {
    setLoading("status")
    const res = await fetch(`/api/tournaments/${tournament.id}/start`, { method: "POST" })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) toast.error(j.error ?? "Тэмцээн эхлүүлэхэд алдаа гарлаа")
    else { toast.success("Тэмцээн эхэллээ"); router.refresh() }
    setLoading(null)
  }

  async function changeStatus(newStatus: Tournament["status"]) {
    setLoading("status")
    // Тэмцээн эхлүүлэх = bracket генерацлах (/start RPC өөрөө status-г ongoing болгоно)
    if (newStatus === "ongoing") {
      if (tournament.platform_fee > 0 && !feePaid) {
        setLoading(null)
        await createBylInvoice()
        return
      }
      await doStart()
      return
    }
    const supabase = createClient()
    const { error } = await supabase
      .from("tournaments")
      .update({ status: newStatus })
      .eq("id", tournament.id)
    if (error) toast.error("Алдаа гарлаа")
    else { toast.success(`Статус: ${mn.tournament.status[newStatus]}`); router.refresh() }
    setLoading(null)
  }

  async function removePlayer(playerId: string, name: string) {
    if (!confirm(`${name}-г тэмцээнээс хасах уу?`)) return
    setLoading(`remove-${playerId}`)
    const supabase = createClient()
    const { error } = await supabase
      .from("tournament_registrations")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId)
    if (error) toast.error("Алдаа гарлаа")
    else {
      setRegs((prev) => prev.filter((r) => r.player_id !== playerId))
      toast.success(`${name} хасагдлаа`)
    }
    setLoading(null)
  }

  async function approvePayment(regId: string, playerId: string) {
    setLoading(`pay-${playerId}`)
    const supabase = createClient()
    const { error } = await supabase
      .from("tournament_registrations")
      .update({ payment_status: "paid" })
      .eq("id", regId)
    if (error) toast.error("Алдаа гарлаа")
    else {
      setRegs((prev) => prev.map((r) => r.id === regId ? { ...r, payment_status: "paid" } : r))
      toast.success("Төлбөр баталгаажлаа")
    }
    setLoading(null)
  }

  async function saveSeed(playerId: string, seed: number) {
    const supabase = createClient()
    await supabase
      .from("tournament_registrations")
      .update({ seed })
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId)
  }

  async function cancelTournament() {
    if (!confirm("Тэмцээнийг цуцлах уу? Энэ үйлдлийг буцааж болохгүй.")) return
    setLoading("cancel")
    const supabase = createClient()
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "cancelled" })
      .eq("id", tournament.id)
    if (!error) { toast.success("Тэмцээн цуцлагдлаа"); router.refresh() }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {/* Status control */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Тэмцээний удирдлага
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Одоогийн статус</p>
              <Badge variant="outline" className={`text-sm px-2 py-0.5 ${
                tournament.status === "registration" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                tournament.status === "ongoing" ? "bg-primary/15 text-primary border-primary/30" :
                tournament.status === "completed" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {mn.tournament.status[tournament.status]}
              </Badge>
            </div>
            {nextStatus && tournament.status !== "cancelled" && (
              <Button
                size="sm"
                onClick={() => changeStatus(nextStatus.to)}
                disabled={loading === "status"}
                className="glow-primary"
              >
                {loading === "status" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {nextStatus.label}
              </Button>
            )}
          </div>

          {/* Платформ шимтгэл */}
          {bylStep !== "idle" && tournament.platform_fee > 0 && !feePaid && (
            <div className="space-y-3 p-3 border border-[oklch(0.78_0.16_85)]/30 bg-[oklch(0.78_0.16_85)]/5 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Платформ шимтгэл</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(tournament.platform_fee)}</p>
                </div>
                {bylStep === "waiting" && (
                  <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">Хүлээгдэж байна</span>
                )}
              </div>

              {bylStep === "loading" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Нэхэмжлэл үүсгэж байна...
                </div>
              )}

              {bylStep === "waiting" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Нэхэмжлэл шинэ цонхонд нээгдлээ. Дэмжигдсэн аппаараа төлж буцаарай.
                  </p>
                  <Button size="sm" className="w-full glow-primary" onClick={checkBylAndStart}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Төлбөр шалгаж эхлүүлэх
                  </Button>
                </>
              )}

              {bylStep === "checking" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Шалгаж байна...
                </div>
              )}

              <Button size="sm" variant="ghost" className="w-full text-muted-foreground text-xs"
                onClick={() => { setBylStep("idle"); setBylTxnId(null) }}>
                Болих
              </Button>
            </div>
          )}

          {tournament.status !== "cancelled" && tournament.status !== "completed" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={cancelTournament}
              disabled={loading === "cancel"}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Тэмцээн цуцлах
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Player management */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Тоглогчийн удирдлага
            <Badge variant="outline" className="text-xs ml-auto border-border/60">
              {regs.length} / {tournament.max_players}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {regs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Бүртгэлтэй тоглогч байхгүй</p>
          ) : (
            regs
              .sort((a, b) => (seeds[a.player_id] || 99) - (seeds[b.player_id] || 99))
              .map((reg, i) => (
              <div key={reg.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
                {/* Seed input */}
                <div className="flex items-center gap-1 shrink-0">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <input
                    type="number"
                    min={1}
                    max={tournament.max_players}
                    value={seeds[reg.player_id] || i + 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || i + 1
                      setSeeds((prev) => ({ ...prev, [reg.player_id]: v }))
                    }}
                    onBlur={() => saveSeed(reg.player_id, seeds[reg.player_id] || i + 1)}
                    className="w-8 h-6 text-center text-xs font-bold rounded border border-border/60 bg-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={reg.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-secondary">
                    {reg.profiles?.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reg.profiles?.display_name}</p>
                  <p className="text-xs text-muted-foreground">{reg.profiles?.rating_points}</p>
                </div>

                {/* Payment status */}
                {tournament.entry_fee > 0 && (
                  <button
                    onClick={() => reg.payment_status !== "paid" && approvePayment(reg.id, reg.player_id)}
                    disabled={reg.payment_status === "paid" || loading === `pay-${reg.player_id}`}
                    className="shrink-0"
                  >
                    {loading === `pay-${reg.player_id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : reg.payment_status === "paid" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <Badge variant="outline" className="text-[10px] cursor-pointer border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                        Төлбөр баталгаажуулах
                      </Badge>
                    )}
                  </button>
                )}

                {/* Remove */}
                <button
                  onClick={() => removePlayer(reg.player_id, reg.profiles?.display_name ?? "?")}
                  disabled={!!loading}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1"
                >
                  {loading === `remove-${reg.player_id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Шагнал тараах — оролцогчдын данс (бооцоотой тэмцээн) */}
      {tournament.entry_fee > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Шагнал тараах — оролцогчдын данс
              <Badge variant="outline" className="text-xs ml-auto border-border/60">{payouts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Дансны мэдээлэл оруулсан оролцогч алга</p>
            ) : (
              payouts.map((p) => (
                <div key={p.player_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.bank_name} · {p.account_holder}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(p.account_number); toast.success("Данс хуулагдлаа") }}
                    className="font-mono text-xs tabular-nums text-foreground hover:text-primary shrink-0"
                    title="Хуулах"
                  >
                    {p.account_number}
                  </button>
                </div>
              ))
            )}
            {payouts.length > 0 && (
              <p className="text-[11px] text-muted-foreground px-4 py-2.5 border-t border-border/30">
                Тэмцээн дууссан/цуцлагдсаны дараа ялагчдад шагналыг эдгээр дансаар шилжүүлнэ үү.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Bracket */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Bracket удирдлага
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href={`/tournaments/${tournament.id}/edit`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "glow-primary justify-center")}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Bracket болон тохиргоо засах
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={async () => {
                const supabase = (await import("@/lib/supabase/client")).createClient()
                const { error } = await supabase
                  .from("tournament_registrations")
                  .update({ payment_status: "paid" })
                  .eq("tournament_id", tournament.id)
                  .eq("payment_status", "pending")
                if (!error) toast.success("Бүх төлбөр баталгаажлаа")
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Бүгдийн төлбөр баталгаажуулах
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Seed тоог өөрчлөхөд bracket эрэмбэ шинэчлэгдэнэ
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
