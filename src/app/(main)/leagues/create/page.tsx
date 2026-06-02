"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Star } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function CreateLeaguePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    season: new Date().getFullYear().toString(),
    format: "501" as "501" | "301" | "cricket",
    start_date: "",
    max_teams: "16",
    description: "",
  })

  function upd<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error("Лигийн нэр оруулна уу")
    if (!form.start_date) return toast.error("Эхлэх огноо оруулна уу")

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error } = await supabase.from("leagues").insert({
      name: form.name.trim(),
      season: form.season,
      format: form.format,
      start_date: form.start_date,
      max_teams: parseInt(form.max_teams),
      description: form.description || null,
      created_by: user.id,
    }).select("id").single()

    if (error) { toast.error("Лиг үүсгэхэд алдаа гарлаа"); setLoading(false); return }
    toast.success("Лиг амжилттай үүслээ!")
    router.push(`/leagues/${data.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/leagues" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-[oklch(0.78_0.16_85)]" />
            Лиг үүсгэх
          </h1>
          <p className="text-muted-foreground text-sm">Шинэ дартсын лиг зохион байгуулах</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Лигийн мэдээлэл</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Лигийн нэр <span className="text-primary">*</span></Label>
              <Input value={form.name} onChange={(e) => upd("name", e.target.value)}
                placeholder="Улаанбаатарын Дартсын Лиг 2026"
                className="bg-secondary/50 border-border/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Улирал</Label>
                <Input value={form.season} onChange={(e) => upd("season", e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Формат</Label>
                <div className="flex gap-1.5">
                  {(["501", "301", "cricket"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => upd("format", f)}
                      className={cn("flex-1 py-1.5 rounded-md border-2 text-xs font-bold transition-all",
                        form.format === f ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                      {f === "cricket" ? "Cricket" : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Эхлэх огноо <span className="text-primary">*</span></Label>
                <Input type="datetime-local" value={form.start_date} onChange={(e) => upd("start_date", e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Хамгийн их баг/тоглогч</Label>
                <Input type="number" min={4} value={form.max_teams} onChange={(e) => upd("max_teams", e.target.value)}
                  className="bg-secondary/50 border-border/60" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Тайлбар</Label>
              <textarea value={form.description} onChange={(e) => upd("description", e.target.value)} rows={3}
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full glow-primary" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Лиг үүсгэх
        </Button>
      </form>
    </div>
  )
}
