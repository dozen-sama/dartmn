"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, ChevronRight, MapPin, Save, Loader2, User } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Profile } from "@/types/database"
import { PROVINCES, getProvince } from "@/lib/provinces"
import { TierBadge } from "@/components/rating/TierBadge"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Props {
  profile: Profile
}

export function ProfileSettingsForm({ profile }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState(profile.display_name)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? "")
  const [province, setProvince] = useState(profile.province ?? "")
  const [city, setCity] = useState(profile.city ?? "")
  const [gender, setGender] = useState(profile.gender ?? "")

  const selectedProvince = getProvince(province)
  const sums = selectedProvince?.sums ?? []

  function handleProvinceSelect(prov: string) {
    if (province === prov) {
      // Дахин дарвал сонголт болих
      setProvince("")
      setCity("")
    } else {
      setProvince(prov)
      setCity("") // сум дахин сонгох
    }
  }

  async function handleSave() {
    if (!displayName.trim()) return toast.error("Дэлгэцийн нэр оруулна уу")
    if (!username.trim()) return toast.error("Хэрэглэгчийн нэр оруулна уу")

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
        bio: bio || null,
        province: province || null,
        city: city || null,
        gender: gender as Profile["gender"] || null,
      })
      .eq("id", profile.id)

    if (error) {
      if (error.code === "23505") toast.error("Энэ хэрэглэгчийн нэр аль хэдийн ашиглагдаж байна")
      else toast.error("Хадгалахад алдаа гарлаа")
    } else {
      toast.success("Профайл амжилттай хадгалагдлаа!")
      router.push(`/profile/${username.trim().toLowerCase()}`)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/profile/${profile.username}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Профайл тохиргоо
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <TierBadge rating={profile.rating_points} size="sm" />
            <span className="text-xs text-muted-foreground">{profile.rating_points} pts</span>
          </div>
        </div>
      </div>

      {/* Үндсэн мэдээлэл */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Үндсэн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Дэлгэцийн нэр</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="bg-secondary/50 border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Хэрэглэгчийн нэр</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="bg-secondary/50 border-border/60 pl-7" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Танилцуулга</Label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Өөрийгөө товч танилцуул..."
              className="w-full rounded-md bg-secondary/50 border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Хүйс</Label>
            <div className="flex gap-2">
              {[
                { v: "male", l: "Эрэгтэй" },
                { v: "female", l: "Эмэгтэй" },
                { v: "other", l: "Бусад" },
              ].map(({ v, l }) => (
                <button key={v} type="button"
                  onClick={() => setGender(gender === v ? "" : v)}
                  className={cn("flex-1 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                    gender === v ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:border-border")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Байршил */}
      <Card className="border-primary/20 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Аймаг · Сум
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Аймаг, сумаа сонгосноор аймгийн чансаанд орно. GPS ашиглахгүй.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Current selection preview */}
          {province && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium flex-1">
                {province}{city ? ` · ${city}` : ""}
              </span>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                Чансаанд орно
              </Badge>
            </div>
          )}

          {/* Аймаг grid */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground uppercase tracking-wide text-[11px]">Аймаг / Нийслэл</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVINCES.map((prov) => {
                const isSelected = province === prov.name
                return (
                  <button key={prov.name} type="button"
                    onClick={() => handleProvinceSelect(prov.name)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-2 rounded-lg border-2 text-left transition-all group",
                      isSelected
                        ? "border-primary bg-primary/15"
                        : "border-border/40 hover:border-border bg-secondary/20"
                    )}>
                    <span className={cn("text-xs font-medium truncate", isSelected ? "text-primary" : "text-foreground/80")}>
                      {prov.name}
                    </span>
                    {isSelected
                      ? <Check className="h-3 w-3 text-primary shrink-0 ml-1" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 ml-1 opacity-0 group-hover:opacity-100" />
                    }
                  </button>
                )
              })}
            </div>
          </div>

          {/* Сумын жагсаалт */}
          {province && sums.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground uppercase tracking-wide text-[11px]">
                {province === "Улаанбаатар" ? "Дүүрэг" : "Сум / Хот"} — {province}
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {sums.map((sum) => {
                  const isSelected = city === sum
                  return (
                    <button key={sum} type="button"
                      onClick={() => setCity(city === sum ? "" : sum)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-2 rounded-lg border-2 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/15"
                          : "border-border/40 hover:border-border bg-secondary/20"
                      )}>
                      <span className={cn("text-xs font-medium truncate", isSelected ? "text-primary" : "text-foreground/80")}>
                        {sum}
                      </span>
                      {isSelected && <Check className="h-3 w-3 text-primary shrink-0 ml-1" />}
                    </button>
                  )
                })}
              </div>
              {/* Custom сум оруулах */}
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Эсвэл гараар оруулах</p>
                <Input value={!sums.includes(city) ? city : ""}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Сум, хот оруулна уу..."
                  className="bg-secondary/50 border-border/60 text-sm h-8" />
              </div>
            </div>
          )}

          {/* Сонгохгүй */}
          {province && (
            <button type="button"
              onClick={() => { setProvince(""); setCity("") }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline">
              Аймаг сонгохгүй
            </button>
          )}
        </CardContent>
      </Card>

      {/* Хадгалах */}
      <Button onClick={handleSave} className="w-full glow-primary" size="lg" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Save className="mr-2 h-4 w-4" />
        Хадгалах
      </Button>
    </div>
  )
}
