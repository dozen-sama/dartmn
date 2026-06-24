"use client"

import { useState } from "react"
import { Check, CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/format"

interface BylPayProps {
  tournamentId: string
  playerId: string
  amount: number
  onSuccess: () => void
}

export function BylPay({ tournamentId, playerId, amount, onSuccess }: BylPayProps) {
  const [step, setStep] = useState<"idle" | "loading" | "waiting" | "checking" | "paid">("idle")
  const [txnId, setTxnId] = useState<string | null>(null)

  async function createInvoice() {
    setStep("loading")
    try {
      const res = await fetch("/api/payments/byl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId, player_id: playerId, amount }),
      })
      const data = await res.json()
      if (data.payment_url) {
        setTxnId(data.transaction_id)
        setStep("waiting")
        window.open(data.payment_url, "_blank", "noopener,noreferrer")
      } else {
        toast.error(data.error ?? "Төлбөрийн холболт амжилтгүй болоо")
        setStep("idle")
      }
    } catch {
      toast.error("Төлбөрийн холболт амжилтгүй болоо")
      setStep("idle")
    }
  }

  async function checkPayment() {
    if (!txnId) return
    setStep("checking")
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", txnId)
      .single()

    if (data?.status === "paid") {
      setStep("paid")
      toast.success("Төлбөр амжилттай төлөгдлөө!")
      onSuccess()
    } else {
      toast.info("Төлбөр хүлээгдэж байна...")
      setStep("waiting")
    }
  }

  if (step === "paid") {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <Check className="h-4 w-4" />
        Төлбөр төлөгдлөө
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {step === "idle" && (
        <Button onClick={createInvoice} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0">
          <CreditCard className="h-4 w-4 mr-2" />
          Онлайн төлбөр төлөх — {formatCurrency(amount)}
        </Button>
      )}

      {step === "loading" && (
        <Button disabled className="w-full bg-blue-600 text-white border-0">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Нэхэмжлэл үүсгэж байна...
        </Button>
      )}

      {step === "waiting" && (
        <div className="space-y-3 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Нэхэмжлэл</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(amount)}</p>
            </div>
            <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">
              Хүлээгдэж байна
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Төлбөрийн хуудас шинэ цонхонд нээгдлээ. Дэмжигдсэн аппаараа төлж буцаарай.
          </p>

          <div className="flex gap-2">
            <Button onClick={checkPayment} variant="outline" className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
              <RefreshCw className="h-4 w-4 mr-2" />
              Төлбөр шалгах
            </Button>
            <Button onClick={createInvoice} variant="ghost" size="sm" className="text-muted-foreground text-xs">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Дахин нээх
            </Button>
          </div>
        </div>
      )}

      {step === "checking" && (
        <Button disabled className="w-full border-blue-500/30 text-blue-400" variant="outline">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Шалгаж байна...
        </Button>
      )}
    </div>
  )
}
