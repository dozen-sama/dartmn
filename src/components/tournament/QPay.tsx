"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, CreditCard, Loader2, RefreshCw, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/format"

interface QPayProps {
  tournamentId: string
  playerId: string
  amount: number
  onSuccess: () => void
}

export function QPay({ tournamentId, playerId, amount, onSuccess }: QPayProps) {
  const [step, setStep] = useState<"idle" | "loading" | "invoice" | "checking" | "paid">("idle")
  const [invoice, setInvoice] = useState<{
    qr_text: string
    qr_image?: string
    transaction_id: string
    urls?: { name: string; description: string; link: string }[]
  } | null>(null)

  async function createInvoice() {
    setStep("loading")
    try {
      const res = await fetch("/api/payments/qpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId, player_id: playerId, amount }),
      })
      const data = await res.json()
      if (data.qr_text) {
        setInvoice(data)
        setStep("invoice")
      } else {
        toast.error("QPay холболт амжилтгүй болоо")
        setStep("idle")
      }
    } catch {
      toast.error("QPay холболт амжилтгүй болоо")
      setStep("idle")
    }
  }

  async function checkPayment() {
    if (!invoice) return
    setStep("checking")
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", invoice.transaction_id)
      .single()

    if (data?.status === "paid") {
      setStep("paid")
      toast.success("Төлбөр амжилттай төлөгдлөө!")
      onSuccess()
    } else {
      toast.info("Төлбөр хүлээгдэж байна...")
      setStep("invoice")
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
          QPay-р төлбөр төлөх — {formatCurrency(amount)}
        </Button>
      )}

      {step === "loading" && (
        <Button disabled className="w-full bg-blue-600 text-white border-0">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          QPay нэхэмжлэл үүсгэж байна...
        </Button>
      )}

      {step === "invoice" && invoice && (
        <div className="space-y-3 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">QPay нэхэмжлэл</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(amount)}</p>
            </div>
            <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">
              Хүлээгдэж байна
            </Badge>
          </div>

          {/* QR code */}
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={invoice.qr_text} size={160} level="M" />
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            QPay апп-аараа QR уншуулж төлбөр төлнө үү
          </p>

          {/* App deep links */}
          {invoice.urls && invoice.urls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {invoice.urls.slice(0, 4).map((url) => (
                <a key={url.name} href={url.link}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">
                  <Smartphone className="h-3 w-3" />
                  {url.name}
                </a>
              ))}
            </div>
          )}

          <Button onClick={checkPayment} variant="outline" className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            {step === "checking" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Шалгаж байна...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Төлбөр шалгах</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
