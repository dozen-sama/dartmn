"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocalGame } from "@/lib/local-game/store"
import { Monitor, Plus, Target, Trash2, Trophy } from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { toast } from "sonner"

const BRACKET_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  groups_knockout: "Groups + Knockout",
  swiss: "Swiss",
}

export function LocalHub() {
  const getSummaries = useLocalGame((s) => s.getSummaries)
  const deleteSession = useLocalGame((s) => s.deleteSession)
  const summaries = getSummaries()

  function handleDelete(id: string, name: string) {
    if (confirm(`"${name}" тоглолтыг устгах уу?`)) {
      deleteSession(id)
      toast.success("Тоглолт устгагдлаа")
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Local тоглолт
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Интернэтгүй офлайн тэмцээн, лиг, тоглолт</p>
        </div>
        <Link href="/local/new" className={cn(buttonVariants(), "glow-primary shrink-0")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Шинэ тоглолт
        </Link>
      </div>

      {summaries.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Target className="h-14 w-14 text-muted-foreground/20" />
            <div>
              <p className="font-semibold text-muted-foreground">Тоглолт байхгүй байна</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Найзуудтайгаа тэмцээн зохиогоод шууд тоглож эхэл
              </p>
            </div>
            <Link href="/local/new" className={cn(buttonVariants(), "mt-2 glow-primary")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Эхний тоглолт үүсгэх
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => (
            <Card key={s.id} className={cn("border-border/50 bg-card/80 card-hover overflow-hidden", s.status === "completed" ? "opacity-70" : "")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/local/${s.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      {s.status === "completed" ? (
                        <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs shrink-0">Дууссан</Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-xs shrink-0 pulse-live">Явагдаж байна</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{s.format.toUpperCase()}</span>
                      <span>·</span>
                      <span>{BRACKET_LABELS[s.bracketType]}</span>
                      <span>·</span>
                      <span>{s.playerCount} тоглогч</span>
                      <span>·</span>
                      <span>{formatDate(s.createdAt)}</span>
                    </div>
                    {s.status === "completed" && s.winnerName && (
                      <div className="flex items-center gap-1.5 mt-2 text-sm">
                        <Trophy className="h-4 w-4 text-[oklch(0.78_0.16_85)]" />
                        <span className="font-semibold text-[oklch(0.78_0.16_85)]">{s.winnerName}</span>
                        <span className="text-muted-foreground">— Ялагч</span>
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
