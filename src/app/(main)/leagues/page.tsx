import { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Star, Plus, Calendar } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDate } from "@/lib/utils/format"
import { League } from "@/types/database"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Лигүүд" }

const statusColors: Record<League["status"], string> = {
  upcoming: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
}

const statusLabels: Record<League["status"], string> = {
  upcoming: "Удахгүй",
  ongoing: "Явагдаж байна",
  completed: "Дууссан",
}

export default async function LeaguesPage() {
  const supabase = await createClient()

  const { data: leagues } = await supabase
    .from("leagues")
    .select("*, profiles(display_name, username)")
    .order("start_date", { ascending: false })
    .limit(50)

  const leagueList = (leagues ?? []) as League[]

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-[oklch(0.78_0.16_85)]" />
            Лигүүд
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{leagueList.length} лиг бүртгэлтэй</p>
        </div>
        <Link href="/leagues/create" className={cn(buttonVariants(), "glow-primary shrink-0")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Лиг үүсгэх
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leagueList.map((league) => (
          <Link key={league.id} href={`/leagues/${league.id}`}>
            <Card className="card-hover border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{league.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Улирал: {league.season}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[league.status]}`}>
                    {statusLabels[league.status]}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(league.start_date)}
                  </span>
                  <span>•</span>
                  <span>{league.format}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {leagueList.length === 0 && (
          <Card className="border-dashed border-border/50 md:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Star className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="font-medium text-muted-foreground">Лиг олдсонгүй</p>
              <Link href="/leagues/create" className={cn(buttonVariants(), "mt-5")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Лиг үүсгэх
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
