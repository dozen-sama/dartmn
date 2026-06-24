"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeft, Globe, MonitorSmartphone, Target, Trophy, Users, Wifi, WifiOff, Zap,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

const TYPES = [
  {
    key: "online",
    href: "/tournaments/create",
    icon: Globe,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    border: "border-primary/30 hover:border-primary/60",
    title: "Online тэмцээн",
    badge: { label: "Интернэт шаардлагатай", color: "bg-primary/10 text-primary border-primary/30" },
    desc: "Тоглогчид бүртгэлтэй акаунтаараа нэгдэнэ. Хураамж, рейтинг, статистик бүгд платформд хадгалагдана.",
    features: [
      { icon: Users, text: "Бүртгэлтэй тоглогчид" },
      { icon: Zap, text: "Онлайн хураамж" },
      { icon: Target, text: "ELO рейтинг шинэчлэгдэнэ" },
      { icon: Wifi, text: "Realtime bracket" },
    ],
    when: "Ашиглах үе: Олон улсын, нийтийн тэмцээн",
  },
  {
    key: "local",
    href: "/local/new",
    icon: MonitorSmartphone,
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    border: "border-blue-500/30 hover:border-blue-500/60",
    title: "Local тэмцээн",
    badge: { label: "Offline боломжтой", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    desc: "Интернэтгүй, бүртгэлгүй, дурын нэртэй тоглогч нэмнэ. Паб, клуб, найзуудын дунд тоглох хамгийн хялбар арга.",
    features: [
      { icon: WifiOff, text: "Интернэт шаардахгүй" },
      { icon: Users, text: "Дурын нэртэй тоглогч" },
      { icon: Target, text: "Single/Double Elim, Round Robin, Swiss" },
      { icon: Trophy, text: "Бүрэн bracket + scoreboard" },
    ],
    when: "Ашиглах үе: Паб найт, найзуудын тэмцээн, офлайн клуб",
  },
]

export function NewTournamentChoice() {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Тэмцээн үүсгэх
          </h1>
          <p className="text-muted-foreground text-sm">Тэмцээний төрлийг сонгоно уу</p>
        </div>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 gap-4">
        {TYPES.map((t) => {
          const Icon = t.icon
          return (
            <Link key={t.key} href={t.href}>
              <Card className={cn(
                "border-2 card-hover cursor-pointer transition-all bg-card/80",
                t.border
              )}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", t.iconBg)}>
                      <Icon className={cn("h-6 w-6", t.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-base">{t.title}</h2>
                        <Badge variant="outline" className={cn("text-[10px]", t.badge.color)}>
                          {t.badge.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>

                      {/* Features */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {t.features.map((f) => (
                          <div key={f.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <f.icon className="h-3 w-3 shrink-0" />
                            <span>{f.text}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground/60 italic">{t.when}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Difference table */}
      <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-secondary/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ялгаа харьцуулалт</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2"></th>
                <th className="text-center text-xs text-primary font-medium px-4 py-2">Online</th>
                <th className="text-center text-xs text-blue-400 font-medium px-4 py-2">Local</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Интернэт", online: "Шаардлагатай", local: "Шаардахгүй" },
                { label: "Тоглогч бүртгэл", online: "Акаунт шаардлагатай", local: "Дурын нэр" },
                { label: "Рейтинг", online: "✓ ELO шинэчлэгдэнэ", local: "✗ Нөлөөлөхгүй" },
                { label: "Хуваалцах", online: "✓ URL-р нэгдэнэ", local: "✗ Зөвхөн нэг төхөөрөмж" },
                { label: "Онлайн хураамж", online: "✓ Боломжтой", local: "✗ Байхгүй" },
                { label: "Offline ажиллах", online: "✗", local: "✓ Бүрэн offline" },
              ].map(({ label, online, local }) => (
                <tr key={label} className="border-b border-border/20 last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{label}</td>
                  <td className="px-4 py-2.5 text-center text-xs">{online}</td>
                  <td className="px-4 py-2.5 text-center text-xs">{local}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
