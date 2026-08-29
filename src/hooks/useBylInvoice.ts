"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type BylInvoiceStep = "idle" | "loading" | "waiting" | "checking" | "paid"

interface CreateInvoiceParams {
  tournamentId?: string
  playerId: string
  amount: number
  purpose?: string
}

type CreateInvoiceResult = { ok: true; paymentUrl: string } | { ok: false; error?: string }

// byl.mn нэхэмжлэл үүсгэх/шалгах давхардсан логикийг нэг дор — OrganizerPanel
// (платформ шимтгэл) болон pricing/checkout (subscription) хоёулаа үүнийг ашиглана.
export function useBylInvoice() {
  const [step, setStep] = useState<BylInvoiceStep>("idle")
  const [txnId, setTxnId] = useState<string | null>(null)

  async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
    setStep("loading")
    try {
      const res = await fetch("/api/payments/byl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: params.tournamentId,
          player_id: params.playerId,
          amount: params.amount,
          purpose: params.purpose,
        }),
      })
      const data = await res.json()
      if (data.payment_url) {
        setTxnId(data.transaction_id)
        setStep("waiting")
        window.open(data.payment_url, "_blank", "noopener,noreferrer")
        return { ok: true, paymentUrl: data.payment_url }
      }
      setStep("idle")
      return { ok: false, error: data.error }
    } catch {
      setStep("idle")
      return { ok: false }
    }
  }

  async function checkPayment(): Promise<boolean> {
    if (!txnId) return false
    setStep("checking")
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", txnId)
      .single()

    if (data?.status === "paid") {
      setStep("paid")
      return true
    }
    setStep("waiting")
    return false
  }

  function reset() {
    setStep("idle")
    setTxnId(null)
  }

  return { step, txnId, createInvoice, checkPayment, reset }
}
