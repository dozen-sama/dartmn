"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, Crown, CreditCard, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"

interface Props {
  userId: string | null
  isPremium: boolean
  premiumExpires: string | null
  clubPlan: string | null
}

type PlanFeature = { text: string; soon?: boolean; hint?: string }

const CLUB_PLANS = [
  {
    key: "basic",
    name: "Basic",
    price: 50000,
    icon: Building2,
    color: "border-slate-400/40 bg-slate-400/5",
    badgeColor: "bg-slate-400/15 text-slate-400 border-slate-400/30",
    blurb: "Жижиг клуб, паб эхлэхэд",
    features: [
      { text: "Клубын хуудас ба лого" },
      { text: "Гишүүдийн удирдлага" },
      { text: "Клубын тэмцээн зохион байгуулах" },
      { text: "Клубын неон tag", hint: "Клубын цол ахих тусам шинэ өнгө нээгдэнэ" },
      { text: "Үндсэн статистик" },
    ] as PlanFeature[],
    missing: [
      { text: "Клубын анимэйшн nameplate хүрээ" },
      { text: "Showcase хуудас" },
      { text: "Priority дэмжлэг" },
    ] as PlanFeature[],
  },
  {
    key: "pro",
    name: "Pro",
    price: 100000,
    icon: Star,
    color: "border-primary/40 bg-primary/5",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    popular: true,
    blurb: "Идэвхтэй, тогтмол тэмцээнтэй клуб",
    features: [
      { text: "Basic-ийн бүх боломж" },
      { text: "Клубын nameplate хүрээ", hint: "⚡ Аянга, 🔥 Гал — анимэйшнтэй клубын хүрээ" },
      { text: "Бүх неон tag өнгө нээлттэй" },
      { text: "Клубын showcase хуудас", hint: "Клубын онцлох мэдээлэл, баг тамирчдын хуудас" },
      { text: "Онцлох тэмцээн", hint: "Тэмцээнг платформын нүүр/жагсаалтад онцолно" },
    ] as PlanFeature[],
    missing: [
      { text: "Priority дэмжлэг" },
      { text: "Дедикейтед менежер" },
    ] as PlanFeature[],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 250000,
    icon: Crown,
    color: "border-yellow-500/40 bg-yellow-500/5",
    badgeColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    blurb: "Том холбоо, лиг, байгууллага",
    features: [
      { text: "Pro-ийн бүх боломж" },
      { text: "Priority дэмжлэг", hint: "Хүсэлт, асуудлыг нэн тэргүүнд шийдвэрлэнэ" },
      { text: "Дедикейтед менежер", hint: "Танай клубыг хариуцсан тусгай ажилтан холбогдоно" },
      { text: "Custom тэмцээний формат", soon: true, hint: "Тусгай дүрэм, бүтэцтэй тэмцээн зохиох" },
      { text: "API холболт", soon: true, hint: "Гадны систем/дэлгэцтэй холбох програмчлалын интерфейс" },
      { text: "Custom брэнд (white-label)", soon: true, hint: "Клубын лого, өнгөөр тохируулсан тусгай харагдац" },
    ] as PlanFeature[],
    missing: [] as PlanFeature[],
  },
]

function FeatureRow({ text, included, soon, hint }: { text: string; included: boolean; soon?: boolean; hint?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 text-sm", included ? "" : "opacity-40")}>
      <div className={cn("mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0",
        included ? (soon ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary") : "bg-secondary text-muted-foreground")}>
        {included ? (soon ? <span className="text-[9px] leading-none">⏳</span> : <Check className="h-2.5 w-2.5" />) : <span className="text-[10px]">—</span>}
      </div>
      <div className="min-w-0">
        <span className={cn("flex items-center gap-1.5 flex-wrap", included ? "" : "line-through text-muted-foreground")}>
          {text}
          {soon && <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight border-amber-500/40 text-amber-400">Удахгүй</Badge>}
        </span>
        {hint && <span className="block text-[11px] text-muted-foreground/70 leading-snug mt-0.5">{hint}</span>}
      </div>
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

      {/* Active plan banner */}
      {(isPremium || clubPlan) && (
        <div className="flex flex-wrap items-center justify-center gap-2 -mt-6">
          {isPremium && (
            <Badge className="bg-purple-600 text-white border-0 px-3 py-1 text-sm">
              <Crown className="h-3.5 w-3.5 mr-1.5" /> Premium идэвхтэй
            </Badge>
          )}
          {clubPlan && (
            <Badge className="bg-green-500 text-white border-0 px-3 py-1 text-sm">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Клуб: {CLUB_PLANS.find(p => p.key === clubPlan)?.name ?? clubPlan} идэвхтэй
            </Badge>
          )}
        </div>
      )}

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
          <Card className={cn("border-purple-500/40 bg-purple-500/5 relative overflow-hidden transition-all",
            isPremium && "ring-2 ring-purple-400/70 shadow-lg shadow-purple-500/10")}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            {isPremium && (
              <div className="absolute top-0 inset-x-0 bg-purple-600 text-white text-[10px] font-bold text-center py-0.5 tracking-wide">
                ТАНЫ ИДЭВХТЭЙ БАГЦ
              </div>
            )}
            <CardContent className={cn("p-6 space-y-5", isPremium && "pt-8")}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-purple-400" />
                  <span className="font-bold text-purple-400">Premium</span>
                  {isPremium && (
                    <Badge className="bg-purple-600 text-white border-0 text-xs">
                      ✓ Идэвхтэй
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
                  { text: "Анимэйшн nameplate хүрээ", hint: "⚡ Аянга · 🔥 Инферно · 👑 Аварга · ✨ Premium · 🏅 Домог" },
                  { text: "Хөдөлгөөнт нэрний эффект (Lottie)", hint: "XP цуглуулж онцгой эффект нээж эдэлнэ" },
                  { text: "Premium ✨ хүрээ ба badge", hint: "Профайл, leaderboard, тоглолт дээр онцолно" },
                  { text: "Платформыг дэмжсэн ивээн тэтгэгч статус" },
                ].map((f) => <FeatureRow key={f.text} text={f.text} included={true} hint={f.hint} />)}
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
              { label: "Статистик, тоглолтын түүх", free: true, premium: true },
              { label: "Achievement, рейтингийн түүх", free: true, premium: true },
              { label: "Рейтингээр нээгдэх хүрээ (Хүрэл/Мөнгө/Алт)", free: true, premium: true },
              { label: "Анимэйшн хүрээ (⚡🔥👑✨🏅)", free: false, premium: true },
              { label: "Хөдөлгөөнт нэрний эффект", free: false, premium: true },
              { label: "Premium ✨ badge", free: false, premium: true },
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
              <Card key={plan.key} className={cn("relative overflow-hidden border-2 transition-all", plan.color,
                isCurrentPlan && "ring-2 ring-green-400/70 shadow-lg shadow-green-500/10")}>
                {isCurrentPlan && (
                  <div className="absolute top-0 inset-x-0 bg-green-500 text-white text-[10px] font-bold text-center py-0.5 tracking-wide">
                    ТАНЫ ИДЭВХТЭЙ БАГЦ
                  </div>
                )}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-primary text-primary-foreground text-[10px] border-0">
                      🔥 Түгээмэл
                    </Badge>
                  </div>
                )}
                <CardContent className={cn("p-5 space-y-5", isCurrentPlan && "pt-7")}>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className={cn("text-xs", plan.badgeColor)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {plan.name}
                      </Badge>
                      {isCurrentPlan && (
                        <Badge className="text-xs border-0 bg-green-500 text-white">
                          ✓ Идэвхтэй
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{plan.blurb}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black">{formatCurrency(plan.price)}</span>
                      <span className="text-muted-foreground mb-0.5 text-sm">/ сар</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {plan.features.map((f) => <FeatureRow key={f.text} text={f.text} included={true} soon={f.soon} hint={f.hint} />)}
                    {plan.missing.map((f) => <FeatureRow key={f.text} text={f.text} included={false} />)}
                  </div>

                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full border-green-500/40 text-green-400 bg-green-500/5" disabled>
                      ✓ Одоогийн багц
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
                { label: "Клубын хуудас ба лого", basic: true, pro: true, ent: true },
                { label: "Гишүүдийн удирдлага", basic: true, pro: true, ent: true },
                { label: "Тэмцээн зохион байгуулах", basic: true, pro: true, ent: true },
                { label: "Неон tag өнгө", basic: "Үндсэн", pro: "Бүгд", ent: "Бүгд" },
                { label: "Клубын nameplate хүрээ", basic: false, pro: true, ent: true },
                { label: "Showcase хуудас", basic: false, pro: true, ent: true },
                { label: "Priority дэмжлэг", basic: false, pro: false, ent: true },
                { label: "API холболт", basic: false, pro: false, ent: "soon" },
                { label: "Custom брэнд (white-label)", basic: false, pro: false, ent: "soon" },
              ].map(({ label, basic, pro, ent }) => (
                <tr key={label} className="border-b border-border/20 last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
                  {[basic, pro, ent].map((val, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {val === "soon" ? (
                        <span className="text-[10px] font-medium text-amber-400">Удахгүй</span>
                      ) : typeof val === "string" ? (
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
