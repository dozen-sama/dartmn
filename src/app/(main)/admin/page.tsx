export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { BarChart3, CreditCard, Shield, Trophy, Users, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"

export const metadata: Metadata = { title: "Админ хяналт самбар" }

export default async function AdminPage() {
  const { supabase } = await requireAdmin()

  const [usersResult, tournamentsResult, paymentsResult, recentUsers, recentTournaments] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase.from("payment_transactions").select("amount").eq("status", "paid"),
    supabase.from("profiles").select("id, username, display_name, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("tournaments").select("id, name, status, created_at").order("created_at", { ascending: false }).limit(5),
  ])

  const totalRevenue = paymentsResult.data?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  const metrics = [
    { label: "Нийт хэрэглэгч", value: formatNumber(usersResult.count ?? 0), icon: Users, color: "text-blue-400", href: "/admin/users" },
    { label: "Нийт тэмцээн", value: formatNumber(tournamentsResult.count ?? 0), icon: Trophy, color: "text-gold", href: "/admin/tournaments" },
    { label: "Нийт орлого", value: formatCurrency(totalRevenue), icon: CreditCard, color: "text-green-400", href: "/admin/payments" },
    { label: "Төлбөрийн тоо", value: formatNumber(paymentsResult.data?.length ?? 0), icon: BarChart3, color: "text-purple-400", href: "/admin/payments" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Админ хяналт самбар
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">DartMN системийн удирдлага</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <Card className="border-border/50 bg-card/80 card-hover">
              <CardContent className="p-4">
                <m.icon className={`h-5 w-5 ${m.color} mb-2`} />
                <p className={`text-2xl font-bold score-display ${m.color}`}>{m.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Сүүлийн бүртгэлтэй хэрэглэгчид
            </CardTitle>
            <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground flex items-center">
              Бүгд <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentUsers.data ?? []).map((u) => (
              <Link key={u.id} href={`/profile/${u.username}`}
                className="flex items-center justify-between text-sm py-1 hover:text-primary transition-colors">
                <span className="font-medium truncate">{u.display_name}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(u.created_at)}</span>
              </Link>
            ))}
            {(recentUsers.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Хэрэглэгч байхгүй байна</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Сүүлийн тэмцээнүүд
            </CardTitle>
            <Link href="/admin/tournaments" className="text-xs text-muted-foreground hover:text-foreground flex items-center">
              Бүгд <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentTournaments.data ?? []).map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`}
                className="flex items-center justify-between text-sm py-1 hover:text-primary transition-colors">
                <span className="font-medium truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(t.created_at)}</span>
              </Link>
            ))}
            {(recentTournaments.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Тэмцээн байхгүй байна</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
