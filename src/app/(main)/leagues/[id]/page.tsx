import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Star, Trophy, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { PlayerName, COSMETIC_FIELDS } from "@/components/cosmetic/PlayerName"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("leagues").select("name").eq("id", id).single()
  return { title: data?.name ?? "Лиг" }
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from("leagues")
    .select("*, profiles!leagues_created_by_fkey(display_name, username)")
    .eq("id", id)
    .single()

  if (!league) notFound()

  const { data: standings } = await supabase
    .from("league_standings")
    .select(`*, profiles(id, display_name, username, avatar_url, rating_points, ${COSMETIC_FIELDS})`)
    .eq("league_id", id)
    .order("points", { ascending: false })
    .limit(50)

  const statusColors: Record<string, string> = {
    upcoming: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    ongoing: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-green-500/15 text-green-400 border-green-500/30",
  }
  const statusLabels: Record<string, string> = {
    upcoming: "Удахгүй", ongoing: "Явагдаж байна", completed: "Дууссан",
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/leagues" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-[oklch(0.78_0.16_85)]" />
            {league.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-xs ${statusColors[league.status]}`}>
              {statusLabels[league.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">Улирал: {league.season}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{league.format.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Эхэлсэн: {formatDate(league.start_date)}
            </span>
            {league.end_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Дуусах: {formatDate(league.end_date)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Хамгийн их: {league.max_teams}
            </span>
          </div>
          {league.description && (
            <p className="text-sm text-muted-foreground mt-3">{league.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Standings */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
          Байрлал
        </h2>

        <Card className="border-border/50 bg-card/80">
          {standings && standings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/20">
                    {["#", "Тоглогч", "T", "W", "L", "Leg+", "Pts"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => {
                    const p = (row as any).profiles
                    return (
                      <tr key={row.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/profile/${p?.username}`} className="font-medium hover:text-primary transition-colors">
                            {p ? <PlayerName p={p} /> : "?"}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs score-display">{row.played}</td>
                        <td className="px-3 py-2.5 text-xs score-display text-green-400">{row.won}</td>
                        <td className="px-3 py-2.5 text-xs score-display text-destructive/70">{row.lost}</td>
                        <td className="px-3 py-2.5 text-xs score-display">{row.legs_won}</td>
                        <td className="px-3 py-2.5 text-sm font-bold score-display text-primary">{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">Байрлалын мэдээлэл байхгүй байна</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
