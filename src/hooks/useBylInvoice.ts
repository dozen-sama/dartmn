"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type BylInvoiceStep = "idle" | "loading" | "waiting" | "checking" | "paid"

interface CreateInvoiceParams {
  tournamentId?: string
  playerId: string
  amount: number
  purpose?: string
  returnPath?: string
}

interface PersistParams {
  purpose?: string
  tournamentId?: string
}

type CreateInvoiceResult = { ok: true; paymentUrl: string } | { ok: false; error?: string }

function storageKeyFor({ purpose, tournamentId }: PersistParams) {
  return `byl_txn:${purpose ?? ""}:${tournamentId ?? ""}`
}

function readStoredTxnId(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredTxnId(key: string, txnId: string | null) {
  try {
    if (txnId) localStorage.setItem(key, txnId)
    else localStorage.removeItem(key)
  } catch {}
}

// byl.mn нэхэмжлэл үүсгэх/шалгах давхардсан логикийг нэг дор — OrganizerPanel
// (платформ шимтгэл) болон pricing/checkout (subscription) хоёулаа үүнийг ашиглана.
//
// `persist` дамжуулбал txnId-г localStorage-д хадгална: BYL-ийн төлбөрийн
// хуудас шинэ tab-д нээгддэг тул хэрэглэгч эх tab-аа дахин ачаалах/хаах үед
// txnId зөвхөн React state-д байсан бол алдагдаж, бодитоор төлсөн ч client
// талын идэвхжүүлэлт (subscriptions/activate гэх мэт) дуудагдахгүй үлдэх
// эрсдэлтэй байсныг (2026-08-29, бодит production тест дээр илэрсэн) засав.
export function useBylInvoice(persist?: PersistParams, onPaid?: (txnId: string) => void | Promise<void>) {
  const storageKey = persist ? storageKeyFor(persist) : null

  const [step, setStep] = useState<BylInvoiceStep>("idle")
  const [txnId, setTxnId] = useState<string | null>(null)

  async function fetchIsPaid(id: string): Promise<boolean> {
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", id)
      .single()
    return data?.status === "paid"
  }

  async function checkPaymentFor(id: string): Promise<boolean> {
    setTxnId(id)
    setStep("checking")
    const paid = await fetchIsPaid(id)
    if (paid) {
      setStep("paid")
      if (storageKey) writeStoredTxnId(storageKey, null)
      // txnId зөвхөн React state-д байсан бол хуудас дахин ачаалагдахад
      // алдагдаж, бодитоор төлсөн ч энэ callback (subscription идэвхжүүлэх,
      // тэмцээн эхлүүлэх гэх мэт) хэзээ ч дуудагдахгүй үлдэх байсан тул
      // localStorage-с сэргээх үед ч энд адилхан дуудагдана.
      await onPaid?.(id)
      return true
    }
    setStep("waiting")
    return false
  }

  // Диск (localStorage)-с уншиж, state тавихыг effect дотор шууд бус хийж
  // байгаа нь санаатай: SSR үед localStorage байхгүй тул initial state/
  // useState lazy initializer-т уншиж болохгүй (server дээр throw хийнэ,
  // эсвэл hydration mismatch үүсгэнэ) — зөвхөн mount-ын дараах effect-д
  // уншина. Мөн эффектийн синхрон биед setState шууд дуудахгүй байхын тулд
  // (checkPaymentFor шиг биш) эхлээд сүлжээний хүсэлтийг хүлээгээд, зөвхөн
  // үр дүн ирсний ДАРАА нэг л удаа state шинэчилнэ.
  useEffect(() => {
    if (!storageKey) return
    const stored = readStoredTxnId(storageKey)
    if (!stored) return
    ;(async () => {
      const paid = await fetchIsPaid(stored)
      setTxnId(stored)
      if (paid) {
        setStep("paid")
        writeStoredTxnId(storageKey, null)
        await onPaid?.(stored)
      } else {
        setStep("waiting")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          return_path: params.returnPath,
        }),
      })
      const data = await res.json()
      if (data.payment_url) {
        setTxnId(data.transaction_id)
        setStep("waiting")
        if (storageKey) writeStoredTxnId(storageKey, data.transaction_id)
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
    return checkPaymentFor(txnId)
  }

  function reset() {
    setStep("idle")
    setTxnId(null)
    if (storageKey) writeStoredTxnId(storageKey, null)
  }

  return { step, txnId, createInvoice, checkPayment, reset }
}
