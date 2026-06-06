export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Users, Crown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatNumber } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"
import { UserRoleSelect } from "./UserRoleSelect"

export const metadata: Metadata = { title: "Хэрэглэгчид — Админ" }

export default async function AdminUsersPage() {
  const { supabase, user } = await requireAdmin()

  const { data: users, count } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, rating_points, matches_played, is_premium, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100)

  const list = users ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Хэрэглэгчид
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Нийт {formatNumber(count ?? 0)} хэрэглэгч</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                {["Нэр", "Эрх (dashboard)", "Рейтинг", "Тоглолт", "Бүртгүүлсэн"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                  <td className="px-3 py-2.5">
                    <Link href={`/profile/${u.username}`} className="font-medium hover:text-primary transition-colors flex items-center gap-1.5">
                      {u.display_name}
                      {u.is_premium && <Crown className="h-3 w-3 text-gold" />}
                    </Link>
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <UserRoleSelect userId={u.id} role={u.role} isSelf={u.id === user.id} />
                  </td>
                  <td className="px-3 py-2.5 text-xs score-display text-primary">{formatNumber(u.rating_points)}</td>
                  <td className="px-3 py-2.5 text-xs score-display">{formatNumber(u.matches_played)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-12 text-center text-muted-foreground text-sm">Хэрэглэгч байхгүй байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
