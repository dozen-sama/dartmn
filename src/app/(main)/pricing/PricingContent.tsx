"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3, Building2, Check, Crown, CreditCard, Star, Trophy, Zap,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"
import Link from "next/link"

interface Props {
  userId: string | null
  isPremium: boolean
  premiumExpires: string | null
  clubPlan: string | null
}

const CLUB_PLANS = [
  {
    key: "basic",
    name: "Basic",
    price: 50000,
    icon: Building2,
    color: "border-slate-400/40 bg-slate-400/5",
    badgeColor: "bg-slate-400/15 text-slate-400 border-slate-400/30",
    features: [
      "Клубын лого оруулах",
      "Клубын хуудас",
      "Сард 5 хүртэл тэмцээн",
      "Үндсэн статистик",
      "Гишүүдийн удирдлага",
    ],
    missing: ["Advanced статистик", "Хязгааргүй тэмцээн", "Priority дэмжлэг"],
  },
  {
    key: "pro",
    name: "Pro",
    price: 100000,
    icon: Star,
    color: "border-primary/40 bg-primary/5",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    popular: true,
    features: [
      "Basic-ийн бүх боломж",
      "Хязгааргүй тэмцээн",
      "Advanced статистик",
      "Клубын рейтинг boost",
      "Онцлох тэмцээн",
      "Клубын мэдэгдэл",
    ],
    missing: ["Priority дэмжлэг", "Custom функц"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 250000,
    icon: Crown,
    color: "border-yellow-500/40 bg-yellow-500/5",
    badgeColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    features: [
      "Pro-ийн бүх боломж",
      "Priority дэмжлэг",
      "Custom тэмцээний формат",
      "API холболт",
      "Дедикейтед менежер",
      "Custom брэнд",
    ],
    missing: [],
  },
]

function FeatureRow({ text, included }: { text: string; included: boolean }) {
  return (
    <div className={cn("flex items-start gap-2.5 text-sm", included ? "" : "opacity-40")}>
      <div className={cn("mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0",
        included ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
        {included ? <Check className="h-2.5 w-2.5" /> : <span className="text-[10px]">—</span>}
      </div>
      <span className={included ? "" : "line-through text-muted-foreground"}>{text}</span>
    </div>
  )
}

export function PricingContent({ userId, isPremium, premiumExpires, clubPlan }: Props) {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleSubscribe(plan: string, amount: number) {
    if (!userId) { router.push("/login"); return }
    setLoadingPlan(plan)
    // QPay-р төлбөр хийнэ — одоогоор /pricing/checkout руу чиглүүлнэ
    router.push(`/pricing/checkout?plan=${plan}&amount=${amount}&type=club`)
    setLoadingPlan(null)
  }

  async function handlePremium() {
    if (!userId) { router.push("/login"); return }
    router.push(`/pricing/checkout?plan=premium&amount=9900&type=player`)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
          DartMN Subscription
        </Badge>
        <h1 className="text-3xl font-bold">Үнэ тариф</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Монголын дартсын платформыг дэмжээд клубаа хөгжүүлэх, тэмцээнүүдийг зохион байгуулах боломжоо нэмэгдүүл.
        </p>
      </div>

      {/* Platform fee notice */}
      <div className="flex items-start gap-4 bg-secondary/30 border border-border/50 rounded-xl p-4 max-w-2xl mx-auto">
        <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            Тэмцээний бүртгэлийн шимтгэл
            <Badge variant="outline" className="text-[10px] border-border/60">Автомат</Badge>
          </h3>
          <p className="text-sm text-muted-foreground">
            Тоглогч тэмцээнд бүртгүүлэхэд тэмцээний хураамжаас гадна <strong className="text-foreground">1,000₮</strong> платформын шимтгэл нэмэгдэнэ.
            Жишээ нь: 20,000₮ тэмцээнд бүртгүүлэхэд нийт <strong className="text-foreground">21,000₮</strong> төлнө.
          </p>
        </div>
      </div>

      {/* ── PREMIUM PLAYER ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Crown className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Premium Player</h2>
            <p className="text-sm text-muted-foreground">Тоглогчдод зориулсан нэмэлт боломжууд</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Premium card */}
          <Card className="border-purple-500/40 bg-purple-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            <CardContent className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-purple-400" />
                  <span className="font-bold text-purple-400">Premium</span>
                  {isPremium && (
                    <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs">
                      Идэвхтэй
                    </Badge>
                  )}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black">9,900</span>
                  <span className="text-muted-foreground mb-1">₮ / сар</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  "Advanced Statistics — нарийн статистик",
                  "Match History — бүрэн тоглолтын түүх",
                  "Rating Graph — рейтингийн хөдөлгөөн",
                  "Achievement unlock — онцгой achievement",
                  "Premium badge профайл дээр",
                  "Тэмцээны эрт бүртгэл",
                ].map((f) => <FeatureRow key={f} text={f} included={true} />)}
              </div>

              {isPremium ? (
                <div className="text-sm text-muted-foreground">
                  {premiumExpires && (
                    <p>Дуусах огноо: <strong className="text-foreground">
                      {new Date(premiumExpires).toLocaleDateString("mn-MN")}
                    </strong></p>
                  )}
                </div>
              ) : (
                <Button onClick={handlePremium}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white border-0">
                  <Crown className="h-4 w-4 mr-2" />
                  Premium болох
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Free vs Premium comparison */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Үнэгүй vs Premium</p>
            {[
              { label: "Үндсэн статистик", free: true, premium: true },
              { label: "Match History (сүүлийн 10)", free: true, premium: true },
              { label: "Бүрэн Match History", free: false, premium: true },
              { label: "Rating Graph", free: false, premium: true },
              { label: "Advanced Stats", free: false, premium: true },
              { label: "Онцгой achievement", free: false, premium: true },
              { label: "Premium badge", free: false, premium: true },
            ].map(({ label, free, premium }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-6">
                  <span className={cn("text-xs", free ? "text-green-400" : "text-muted-foreground/40")}>
                    {free ? "✓" : "—"}
                  </span>
                  <span className={cn("text-xs w-14 text-right", premium ? "text-purple-400 font-semibold" : "text-muted-foreground/40")}>
                    {premium ? "✓ Premium" : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── CLUB SUBSCRIPTION ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Клубын subscription</h2>
            <p className="text-sm text-muted-foreground">Клуб, паб, байгууллагад зориулсан</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CLUB_PLANS.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = clubPlan === plan.key
            return (
              <Card key={plan.key} className={cn("relative overflow-hidden border-2", plan.color)}>
                {plan.popular && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-primary text-primary-foreground text-[10px] border-0">
                      🔥 Түгээмэл
                    </Badge>
                  </div>
                )}
                <CardContent className="p-5 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className={cn("text-xs", plan.badgeColor)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {plan.name}
                      </Badge>
                      {isCurrentPlan && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-400 bg-green-500/10">
                          Идэвхтэй
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black">{formatCurrency(plan.price)}</span>
                      <span className="text-muted-foreground mb-0.5 text-sm">/ сар</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {plan.features.map((f) => <FeatureRow key={f} text={f} included={true} />)}
                    {plan.missing.map((f) => <FeatureRow key={f} text={f} included={false} />)}
                  </div>

                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full border-border/60" disabled>
                      Одоогийн план
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.key, plan.price)}
                      disabled={loadingPlan === plan.key}
                      className={cn("w-full", plan.popular ? "glow-primary" : "border-border/60")}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.name} сонгох
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs text-muted-foreground font-medium py-2 pr-4">Боломж</th>
                <th className="text-center text-xs text-muted-foreground font-medium py-2 px-3 w-24">Basic</th>
                <th className="text-center text-xs text-primary font-medium py-2 px-3 w-24">Pro</th>
                <th className="text-center text-xs text-yellow-400 font-medium py-2 px-3 w-24">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Клубын лого", basic: true, pro: true, ent: true },
                { label: "Клубын хуудас", basic: true, pro: true, ent: true },
                { label: "Гишүүдийн удирдлага", basic: true, pro: true, ent: true },
                { label: "Сард тэмцээн", basic: "5", pro: "Хязгааргүй", ent: "Хязгааргүй" },
                { label: "Advanced статистик", basic: false, pro: true, ent: true },
                { label: "Клубын рейтинг boost", basic: false, pro: true, ent: true },
                { label: "Priority дэмжлэг", basic: false, pro: false, ent: true },
                { label: "API холболт", basic: false, pro: false, ent: true },
              ].map(({ label, basic, pro, ent }) => (
                <tr key={label} className="border-b border-border/20 last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
                  {[basic, pro, ent].map((val, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {typeof val === "string" ? (
                        <span className="text-xs font-medium">{val}</span>
                      ) : val ? (
                        <Check className="h-4 w-4 text-green-400 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30 text-lg">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-center">Түгээмэл асуулт</h2>
        {[
          {
            q: "Төлбөрийг хэрхэн төлөх вэ?",
            a: "QPay болон SocialPay-р төлбөр хийх боломжтой. Монголын бүх банкны апп-аар хийж болно.",
          },
          {
            q: "Subscription-г цуцлах боломжтой юу?",
            a: "Хэзээ ч цуцлах боломжтой. Цуцалсан тохиолдолд хугацаа дуусах хүртэл ашиглах боломжтой.",
          },
          {
            q: "Платформын шимтгэл яагаад байдаг вэ?",
            a: "1,000₮ шимтгэл нь платформын хөгжил, серверийн зардалд зарцуулагдана.",
          },
          {
            q: "Клубын subscription-г нэгтгэж болох уу?",
            a: "Нэг клубт нэг л subscription идэвхтэй байна. Upgrade хийх боломжтой.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-border/40 pb-4">
            <p className="font-medium text-sm mb-1">{q}</p>
            <p className="text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
