"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Building2, Loader2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function CreateClubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    tag: "",
    description: "",
    city: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  })

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  // Auto-suggest tag from name
  function suggestTag(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean)
    const tag = words.map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 5)
    if (tag.length >= 2) upd("tag", tag)
  }

  const tagValid = /^[A-Z0-9]{2,5}$/.test(form.tag)
  const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error("Клубын нэр оруулна уу")
    if (!tagValid) return toast.error("Tag 2-5 том үсэг/тоо байх ёстой")

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error } = await supabase
      .from("clubs")
      .insert({
        name: form.name.trim(),
        slug: slug || form.tag.toLowerCase(),
        tag: form.tag.toUpperCase(),
        description: form.description || null,
        city: form.city || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        owner_id: user.id,
        features: [] as any,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") toast.error("Энэ нэр эсвэл tag аль хэдийн ашиглагдаж байна")
      else toast.error("Клуб үүсгэхэд алдаа гарлаа")
      setLoading(false)
      return
    }

    // Auto-join as owner
    await supabase.from("club_members").insert({
      club_id: data.id, player_id: user.id, role: "owner",
    })

    toast.success("Клуб амжилттай үүслээ!")
    router.push(`/clubs/${data.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/clubs" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Клуб үүсгэх
          </h1>
          <p className="text-muted-foreground text-sm">Дартсын клуб, паб байгуулах</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Үндсэн мэдээлэл</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Клубын нэр <span className="text-primary">*</span></Label>
              <Input value={form.name}
                onChange={(e) => { upd("name", e.target.value); suggestTag(e.target.value) }}
                placeholder="Bulls Darts Club"
                className="bg-secondary/50 border-border/60" />
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Клубын Tag <span className="text-primary">*</span>
                <span className="text-xs text-muted-foreground font-normal">2-5 том үсэг</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  value={form.tag}
                  onChange={(e) => upd("tag", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                  placeholder="BDC"
                  maxLength={5}
                  className={cn("bg-secondary/50 border-border/60 w-28 text-center font-mono font-bold text-lg tracking-widest",
                    form.tag && !tagValid ? "border-destructive" : form.tag && tagValid ? "border-green-500/50" : "")}
                />
                {form.name && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>Харагдах байдал:</span>
                    <Badge variant="outline" className="border-primary/30 text-primary font-mono">
                      [{form.tag || "TAG"}]
                    </Badge>
                    <span>Бат-Эрдэнэ</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Гишүүдийн нэрний урд автоматаар харагдана. жнь. <strong>[BDC] Бат-Эрдэнэ</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Тайлбар</Label>
              <textarea value={form.description} onChange={(e) => upd("description", e.target.value)} rows={3}
                placeholder="Клубын тухай товч мэдээлэл..."
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Холбоо барих</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { k: "city", l: "Хот/Аймаг", p: "Улаанбаатар" },
              { k: "address", l: "Хаяг", p: "Баянгол дүүрэг..." },
              { k: "phone", l: "Утас", p: "+976 9999-9999" },
              { k: "email", l: "Имэйл", p: "club@example.com" },
            ].map(({ k, l, p }) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-sm">{l}</Label>
                <Input value={form[k as keyof typeof form]}
                  onChange={(e) => upd(k as keyof typeof form, e.target.value)}
                  placeholder={p} className="bg-secondary/50 border-border/60" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full glow-primary" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Клуб үүсгэх
        </Button>
      </form>
    </div>
  )
}
