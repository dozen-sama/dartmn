"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Calendar, Loader2, Trophy } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"
import Link from "next/link"

interface Props {
  userId: string
  clubs: { id: string; name: string }[]
}

export function CreateTournamentForm({ userId, clubs }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    club_id: "",
    format: "501" as "501" | "301" | "cricket" | "cutthroat",
    type: "singles" as "singles" | "doubles" | "team",
    bracket_type: "single_elimination" as "single_elimination" | "double_elimination" | "round_robin" | "swiss",
    max_players: "16",
    entry_fee: "0",
    prize_pool: "0",
    start_date: "",
    registration_deadline: "",
    location: "",
  })

  function update<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return toast.error("Тэмцээний нэр оруулна уу")
    if (!form.start_date) return toast.error("Эхлэх огноо оруулна уу")

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: form.name,
        description: form.description || null,
        club_id: form.club_id || null,
        organizer_id: userId,
        format: form.format,
        type: form.type,
        bracket_type: form.bracket_type,
        status: "draft",
        max_players: parseInt(form.max_players),
        entry_fee: parseInt(form.entry_fee),
        prize_pool: parseInt(form.prize_pool),
        start_date: form.start_date,
        registration_deadline: form.registration_deadline || null,
        location: form.location || null,
      })
      .select("id")
      .single()

    if (error) {
      toast.error("Тэмцээн үүсгэхэд алдаа гарлаа")
      setLoading(false)
      return
    }

    toast.success("Тэмцээн амжилттай үүслээ!")
    router.push(`/tournaments/${data!.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tournaments" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {mn.tournament.create}
          </h1>
          <p className="text-muted-foreground text-sm">Шинэ тэмцээн зохион байгуулах</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Basic Info */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Үндсэн мэдээлэл</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Тэмцээний нэр <span className="text-primary">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Монголын нээлттэй чемпионат 2026"
                  className="bg-secondary/50 border-border/60"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Тайлбар</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Тэмцээний дэлгэрэнгүй мэдээлэл..."
                  rows={3}
                  className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {clubs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Клуб</Label>
                  <Select value={form.club_id} onValueChange={(v) => v && update("club_id", v)}>
                    <SelectTrigger className="bg-secondary/50 border-border/60">
                      <SelectValue placeholder="Клуб сонгох (сонголтоор)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Format */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Тэмцээний формат</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{mn.tournament.format}</Label>
                <Select value={form.format} onValueChange={(v) => v && update("format", v as typeof form.format)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="501">501</SelectItem>
                    <SelectItem value="301">301</SelectItem>
                    <SelectItem value="cricket">Крикет</SelectItem>
                    <SelectItem value="cutthroat">Катроат</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{mn.tournament.type}</Label>
                <Select value={form.type} onValueChange={(v) => v && update("type", v as typeof form.type)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Ганцаарчилсан</SelectItem>
                    <SelectItem value="doubles">Хосоор</SelectItem>
                    <SelectItem value="team">Багаар</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Хаалтын төрөл</Label>
                <Select value={form.bracket_type} onValueChange={(v) => v && update("bracket_type", v as typeof form.bracket_type)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_elimination">Нэг алдалтаар унах</SelectItem>
                    <SelectItem value="double_elimination">Хоёр алдалтаар унах</SelectItem>
                    <SelectItem value="round_robin">Дугуй аялгуу</SelectItem>
                    <SelectItem value="swiss">Швейцари</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Players */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Хуваарь ба тоглогчид</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Эхлэх огноо <span className="text-primary">*</span></Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => update("start_date", e.target.value)}
                    className="bg-secondary/50 border-border/60 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Бүртгэлийн дедлайн</Label>
                <Input
                  type="datetime-local"
                  value={form.registration_deadline}
                  onChange={(e) => update("registration_deadline", e.target.value)}
                  className="bg-secondary/50 border-border/60"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Хамгийн их тоглогч</Label>
                <Select value={form.max_players} onValueChange={(v) => v && update("max_players", v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 32, 64].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} тоглогч</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Байршил</Label>
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="ДартMN Клуб, Улаанбаатар"
                  className="bg-secondary/50 border-border/60"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Төлбөр</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Оролцооны хураамж (₮)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.entry_fee}
                  onChange={(e) => update("entry_fee", e.target.value)}
                  className="bg-secondary/50 border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Шагналын сан (₮)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.prize_pool}
                  onChange={(e) => update("prize_pool", e.target.value)}
                  className="bg-secondary/50 border-border/60"
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full glow-primary" size="lg" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Тэмцээн үүсгэх
          </Button>
        </div>
      </form>
    </div>
  )
}
