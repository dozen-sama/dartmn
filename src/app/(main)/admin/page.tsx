export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BarChart3, CreditCard, Shield, Trophy, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Админ хяналт самбар" }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/dashboard")

  const [usersResult, tournamentsResult, paymentsResult] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase.from("payment_transactions").select("amount").eq("status", "paid"),
  ])

  const totalRevenue = paymentsResult.data?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  const metrics = [
    { label: "Нийт хэрэглэгч", value: formatNumber(usersResult.count ?? 0), icon: Users, color: "text-blue-400" },
    { label: "Нийт тэмцээн", value: formatNumber(tournamentsResult.count ?? 0), icon: Trophy, color: "text-gold" },
    { label: "Нийт орлого", value: formatCurrency(totalRevenue), icon: CreditCard, color: "text-green-400" },
    { label: "Төлбөрийн тоо", value: formatNumber(paymentsResult.data?.length ?? 0), icon: BarChart3, color: "text-purple-400" },
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
          <Card key={m.label} className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <m.icon className={`h-5 w-5 ${m.color} mb-2`} />
              <p className={`text-2xl font-bold score-display ${m.color}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Сүүлийн бүртгэлтэй хэрэглэгчид
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Удахгүй нэмэгдэнэ...</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Сүүлийн тэмцээнүүд
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Удахгүй нэмэгдэнэ...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
