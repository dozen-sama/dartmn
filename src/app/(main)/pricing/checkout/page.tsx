"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useEffect, useState } from "react"
import { ArrowLeft, Check, Crown, CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"

const PLAN_LABELS: Record<string, string> = {
  basic: "Club Basic",
  pro: "Club Pro",
  enterprise: "Club Enterprise",
  premium: "Premium Player",
}

function CheckoutForm() {
  const params = useSearchParams()
  const router = useRouter()

  const plan = params.get("plan") ?? ""
  const amount = parseInt(params.get("amount") ?? "0")
  const type = params.get("type") ?? "player"

  const [step, setStep] = useState<"idle" | "loading" | "waiting" | "paid">("idle")
  const [txnId, setTxnId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
      else router.push("/login")
    })
  }, [])

  const platformFee = type === "player" ? 0 : 0 // subscription-д shim байхгүй
  const total = amount + platformFee

  async function createInvoice() {
    if (!userId) return
    setStep("loading")
    try {
      const res = await fetch("/api/payments/byl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: userId,
          tournament_id: "00000000-0000-0000-0000-000000000000",
          amount: total,
          purpose: `subscription_${plan}`,
        }),
      })
      const data = await res.json()
      if (data.payment_url) {
        setTxnId(data.transaction_id)
        setStep("waiting")
        window.open(data.payment_url, "_blank", "noopener,noreferrer")
      } else {
        toast.error(data.error ?? "byl.mn холболт амжилтгүй")
        setStep("idle")
      }
    } catch {
      toast.error("Алдаа гарлаа")
      setStep("idle")
    }
  }

  async function checkPayment() {
    if (!txnId) return
    const supabase = createClient()
    const { data } = await supabase
      .from("payment_transactions")
      .select("status")
      .eq("id", txnId)
      .single()

    if (data?.status === "paid") {
      setStep("paid")
      toast.success("Төлбөр амжилттай!")
      if (type === "player" && userId) {
        await fetch("/api/subscriptions/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: userId, transaction_id: txnId }),
        })
      }
      setTimeout(() => router.push("/profile"), 2000)
    } else {
      toast.info("Төлбөр хүлээгдэж байна...")
    }
  }

  if (step === "paid") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold">Төлбөр амжилттай!</h2>
        <p className="text-muted-foreground text-sm">{PLAN_LABELS[plan] ?? plan} идэвхжлээ</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pricing" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Subscription</h1>
          <p className="text-muted-foreground text-sm">{PLAN_LABELS[plan] ?? plan}</p>
        </div>
      </div>

      {/* Order summary */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-sm">Захиалгын дэлгэрэнгүй</h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{PLAN_LABELS[plan] ?? plan}</span>
              <span className="text-sm font-medium">{formatCurrency(amount)}/сар</span>
            </div>
            {platformFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Платформын шимтгэл</span>
                <span className="text-sm font-medium">{formatCurrency(platformFee)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-3 flex items-center justify-between">
            <span className="font-semibold">Нийт</span>
            <span className="text-xl font-black text-primary">{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
            <span>💡</span>
            <span>Сар бүр автоматаар дахин сунгагдахгүй. Дараагийн сард дахин захиалах шаардлагатай.</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Төлбөр
          </h2>

          {step === "idle" && (
            <Button onClick={createInvoice} className="w-full glow-primary" size="lg">
              <CreditCard className="h-4 w-4 mr-2" />
              byl.mn-ээр {formatCurrency(total)} төлөх
            </Button>
          )}

          {step === "loading" && (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Нэхэмжлэл үүсгэж байна...
            </Button>
          )}

          {step === "waiting" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Төлбөрийн хуудас шинэ цонхонд нээгдлээ.<br />
                QPay, SocialPay, Golomt-аар <strong className="text-foreground">{formatCurrency(total)}</strong> төлж буцаарай.
              </p>
              <div className="flex gap-2">
                <Button onClick={checkPayment} className="flex-1 glow-primary">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Төлбөр шалгах
                </Button>
                <Button onClick={createInvoice} variant="outline" size="sm" className="border-border/60">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  )
}
