export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, CreditCard } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatDateTime, formatNumber, formatCurrency } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Төлбөрүүд — Админ" }

const statusLabels: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлсөн",
  failed: "Амжилтгүй",
  refunded: "Буцаагдсан",
}
const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  paid: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  refunded: "bg-secondary text-muted-foreground border-border/50",
}

export default async function AdminPaymentsPage() {
  const { supabase } = await requireAdmin()

  const { data: txns, count } = await supabase
    .from("payment_transactions")
    .select("id, player_id, amount, currency, provider, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100)

  const list = txns ?? []

  // Тоглогчдын нэрийг тусад нь татаж map үүсгэх
  const playerIds = [...new Set(list.map((t) => t.player_id))]
  const { data: players } = playerIds.length
    ? await supabase.from("profiles").select("id, username, display_name").in("id", playerIds)
    : { data: [] }
  const playerMap = new Map((players ?? []).map((p) => [p.id, p]))

  const totalPaid = list.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-400" />
            Төлбөрүүд
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Нийт {formatNumber(count ?? 0)} гүйлгээ</p>
        </div>
      </div>

      <Card className="border-green-500/20 bg-card/80">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Төлсөн нийт орлого (харагдаж буй)</p>
          <p className="text-2xl font-bold score-display text-green-400 mt-0.5">{formatCurrency(totalPaid)}</p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                {["Тоглогч", "Дүн", "Суваг", "Төлөв", "Огноо"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const p = playerMap.get(t.player_id)
                return (
                  <tr key={t.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                    <td className="px-3 py-2.5">
                      {p ? (
                        <Link href={`/profile/${p.username}`} className="font-medium hover:text-primary transition-colors">{p.display_name}</Link>
                      ) : (
                        <span className="text-muted-foreground">?</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs score-display whitespace-nowrap">{formatCurrency(t.amount, t.currency)}</td>
                    <td className="px-3 py-2.5 text-xs uppercase text-muted-foreground">{t.provider}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[t.status] ?? statusColors.pending}`}>
                        {statusLabels[t.status] ?? t.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-12 text-center text-muted-foreground text-sm">Төлбөр байхгүй байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
