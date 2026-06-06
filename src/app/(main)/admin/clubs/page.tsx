export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Building2, BadgeCheck, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatNumber } from "@/lib/utils/format"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Клубууд — Админ" }

export default async function AdminClubsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? "").trim().replace(/[,()*%]/g, "")

  let query = supabase
    .from("clubs")
    .select("id, name, tag, phone, member_count, is_verified, club_score, club_rank, created_at", { count: "exact" })

  if (q) {
    query = query.or(`name.ilike.%${q}%,tag.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: clubs, count } = await query.order("club_score", { ascending: false }).limit(100)
  const list = clubs ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Клубууд
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {q ? `"${q}" — ${formatNumber(count ?? 0)} илэрц` : `Нийт ${formatNumber(count ?? 0)} клуб`}
          </p>
        </div>
      </div>

      {/* Хайлт — нэр, tag, утас */}
      <form className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Клубын нэр, [TAG], утсаар хайх..."
          className="pl-9 bg-secondary/50 border-border/60" />
      </form>

      <Card className="border-border/50 bg-card/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                {["Нэр", "Гишүүд", "Оноо", "Чансаа", "Төлөв", "Үүсгэсэн"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                  <td className="px-3 py-2.5">
                    <Link href={`/clubs/${c.id}`} className="font-medium hover:text-primary transition-colors flex items-center gap-1.5">
                      {c.name}
                      {c.tag && <span className="text-xs text-muted-foreground">[{c.tag}]</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs score-display">{formatNumber(c.member_count)}</td>
                  <td className="px-3 py-2.5 text-xs score-display text-primary">{formatNumber(c.club_score)}</td>
                  <td className="px-3 py-2.5 text-xs score-display">{c.club_rank ? `#${c.club_rank}` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {c.is_verified ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30">
                        <BadgeCheck className="h-3 w-3 mr-0.5" /> Баталгаажсан
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground border-border/50">Энгийн</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-muted-foreground text-sm">Клуб байхгүй байна</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
