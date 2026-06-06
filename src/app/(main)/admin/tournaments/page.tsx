export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Trophy } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatNumber, formatCurrency } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Тэмцээнүүд — Админ" }

const statusLabels: Record<string, string> = {
  draft: "Ноорог",
  registration: "Бүртгэл",
  ongoing: "Явагдаж байна",
  completed: "Дууссан",
  cancelled: "Цуцлагдсан",
}
const statusColors: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground border-border/50",
  registration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

export default async function AdminTournamentsPage() {
  const { supabase } = await requireAdmin()

  const { data: tournaments, count } = await supabase
    .from("tournaments")
    .select("id, name, status, current_players, max_players, entry_fee, prize_pool, start_date", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100)

  const list = tournaments ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" />
            Тэмцээнүүд
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Нийт {formatNumber(count ?? 0)} тэмцээн</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                {["Нэр", "Төлөв", "Тоглогч", "Хураамж", "Шагнал", "Огноо"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                  <td className="px-3 py-2.5">
                    <Link href={`/tournaments/${t.id}`} className="font-medium hover:text-primary transition-colors">{t.name}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${statusColors[t.status] ?? statusColors.draft}`}>
                      {statusLabels[t.status] ?? t.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs score-display whitespace-nowrap">{t.current_players}/{t.max_players}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{t.entry_fee > 0 ? formatCurrency(t.entry_fee) : "Үнэгүй"}</td>
                  <td className="px-3 py-2.5 text-xs text-gold whitespace-nowrap">{t.prize_pool > 0 ? formatCurrency(t.prize_pool) : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.start_date)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-muted-foreground text-sm">Тэмцээн байхгүй байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
