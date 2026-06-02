"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, Minus, Plus, Settings } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function ClubEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  const [tagline, setTagline] = useState("")
  const [description, setDescription] = useState("")
  const [city, setCity] = useState("")
  const [website, setWebsite] = useState("")
  const [features, setFeatures] = useState<string[]>([""])
  const [discord, setDiscord] = useState("")
  const [facebook, setFacebook] = useState("")
  const [instagram, setInstagram] = useState("")
  const [hasSub, setHasSub] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data } = await supabase.from("clubs").select("*").eq("id", id).single()
      if (!data) { router.push("/clubs"); return }
      if (data.owner_id !== user.id) { router.push(`/clubs/${id}`); return }

      setName(data.name)
      setTag(data.tag ?? "")
      setTagline(data.tagline ?? "")
      setDescription(data.description ?? "")
      setCity(data.city ?? "")
      setWebsite(data.website ?? "")
      setFeatures(Array.isArray(data.features) && data.features.length > 0 ? data.features : [""])
      setDiscord(data.social_discord ?? "")
      setFacebook(data.social_facebook ?? "")
      setInstagram(data.social_instagram ?? "")
      setHasSub(!!data.subscription_plan)
      setFetching(false)
    }
    load()
  }, [id])

  const tagValid = !tag || /^[A-Z0-9]{2,5}$/.test(tag)

  async function handleSave() {
    if (!name.trim()) return toast.error("Клубын нэр оруулна уу")
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from("clubs").update({
      name: name.trim(),
      tag: tag.toUpperCase() || null,
      tagline: tagline || null,
      description: description || null,
      city: city || null,
      website: website || null,
      features: features.filter(Boolean),
      social_discord: discord || null,
      social_facebook: facebook || null,
      social_instagram: instagram || null,
    }).eq("id", id)

    if (error) toast.error("Хадгалахад алдаа гарлаа")
    else { toast.success("Клуб шинэчлэгдлээ!"); router.push(`/clubs/${id}`) }
    setLoading(false)
  }

  if (fetching) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/clubs/${id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Клуб засах
        </h1>
      </div>

      <div className="space-y-4">
        {/* Basic */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Үндсэн мэдээлэл</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Клубын нэр</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/60" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-2">
                Клубын Tag
                <span className="text-xs text-muted-foreground font-normal">2-5 том үсэг</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                  placeholder="BDC" maxLength={5}
                  className={cn("bg-secondary/50 border-border/60 w-28 text-center font-mono font-bold text-lg tracking-widest",
                    tag && !tagValid ? "border-destructive" : "")} />
                {tag && tagValid && (
                  <p className="text-sm text-muted-foreground">
                    Харагдах байдал: <Badge variant="outline" className="font-mono border-primary/30 text-primary">[{tag}]</Badge> Нэр
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Тайлбар</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Хот/Аймаг</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="bg-secondary/50 border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Вэб хуудас</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="bg-secondary/50 border-border/60" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Showcase — subscription only */}
        <Card className={cn("border-border/50 bg-card/80", !hasSub && "opacity-60")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              ✨ Showcase тохиргоо
              {!hasSub && <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground">Subscription шаардлагатай</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("space-y-3", !hasSub && "pointer-events-none")}>
            <div className="space-y-1.5">
              <Label className="text-sm">Tagline / Уриа үг</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)}
                placeholder="Улаанбаатарын шилдэг дартсын клуб"
                className="bg-secondary/50 border-border/60" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Давуу талууд</Label>
              {features.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <Input value={f} onChange={(e) => {
                    const next = [...features]; next[i] = e.target.value; setFeatures(next)
                  }} placeholder={`Давуу тал ${i + 1}`} className="bg-secondary/50 border-border/60" />
                  <button onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                    disabled={features.length <= 1}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-30 p-1">
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {features.length < 6 && (
                <button onClick={() => setFeatures([...features, ""])}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Давуу тал нэмэх
                </button>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-sm text-muted-foreground">Сошиал хаягууд</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Instagram", val: instagram, set: setInstagram, ph: "@clubname" },
                  { label: "Facebook", val: facebook, set: setFacebook, ph: "page name" },
                  { label: "Discord", val: discord, set: setDiscord, ph: "invite link" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{label}</Label>
                    <Input value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
                      className="bg-secondary/50 border-border/60 text-xs h-8" />
                  </div>
                ))}
              </div>
            </div>

            {hasSub && (
              <Link href={`/clubs/${id}/showcase`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full border-primary/30 text-primary hover:bg-primary/10 justify-center")}>
                Showcase харах →
              </Link>
            )}
          </CardContent>
        </Card>

        {!hasSub && (
          <Link href="/pricing"
            className={cn(buttonVariants({ variant: "outline" }), "w-full border-primary/30 text-primary hover:bg-primary/10 justify-center")}>
            ✨ Subscription авч Showcase нэмэх
          </Link>
        )}

        <Button onClick={handleSave} className="w-full glow-primary" size="lg" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Хадгалах
        </Button>
      </div>
    </div>
  )
}
