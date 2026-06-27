export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Users, Crown, Search, Pencil } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"
import { UserRoleSelect } from "./UserRoleSelect"

export const metadata: Metadata = { title: "Хэрэглэгчид — Админ" }

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, user } = await requireAdmin()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? "").trim().replace(/[,()*%]/g, "")

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, phone, role, rating_points, matches_played, is_premium, created_at", { count: "exact" })

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: users, count } = await query.order("created_at", { ascending: false }).limit(100)
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
          <p className="text-muted-foreground text-sm mt-0.5">
            {q ? `"${q}" — ${formatNumber(count ?? 0)} илэрц` : `Нийт ${formatNumber(count ?? 0)} хэрэглэгч`}
          </p>
        </div>
      </div>

      {/* Хайлт — нэр, username, утас */}
      <form className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Нэр, @username, утсаар хайх..."
          className="pl-9 bg-secondary/50 border-border/60" />
      </form>

      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                {["Нэр", "Утас", "Эрх (dashboard)", "Чансаа", "Тоглолт", ""].map((h) => (
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
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{u.phone ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <UserRoleSelect userId={u.id} role={u.role} isSelf={u.id === user.id} />
                  </td>
                  <td className="px-3 py-2.5 text-xs score-display text-primary">{formatNumber(u.rating_points)}</td>
                  <td className="px-3 py-2.5 text-xs score-display">{formatNumber(u.matches_played)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/users/${u.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-muted-foreground text-sm">
                  {q ? "Илэрц олдсонгүй" : "Хэрэглэгч байхгүй байна"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
