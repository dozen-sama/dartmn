"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, Loader2, Save, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { NamePlate } from "@/components/cosmetic/NamePlate"
import { PROFILE_FRAMES, isFrameUnlocked, COLOR_PRESETS, FONT_OPTIONS } from "@/lib/frames"
import { cn } from "@/lib/utils"

interface Props {
  profileId: string
  displayName: string
  initial: { frame: string | null; color: string | null; font: string | null; animated: boolean }
  unlock: { rating: number; isPremium: boolean }
}

export function NameplateCustomizer({ profileId, displayName, initial, unlock }: Props) {
  const router = useRouter()
  const [frame, setFrame] = useState(initial.frame ?? "none")
  const [color, setColor] = useState(initial.color ?? "")
  const [font, setFont] = useState(initial.font ?? "")
  const [animated, setAnimated] = useState(initial.animated)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({
      equipped_frame: frame === "none" ? null : frame,
      name_color: color || null,
      name_font: font || null,
      name_animated: animated,
    }).eq("id", profileId)
    if (error) toast.error("Хадгалахад алдаа гарлаа")
    else { toast.success("Нэрийн хээ хадгалагдлаа!"); router.refresh() }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Урьдчилан харах */}
      <Card className="border-primary/20 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Урьдчилан харах</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-10 bg-secondary/20 rounded-b-lg">
          <div className="text-2xl">
            <NamePlate name={displayName} frame={frame} color={color} font={font} animated={animated} variant="full" />
          </div>
        </CardContent>
      </Card>

      {/* Хүрээ */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Хүрээ сонгох</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PROFILE_FRAMES.map((f) => {
            const unlocked = isFrameUnlocked(f, unlock)
            const selected = frame === f.key
            return (
              <button key={f.key} type="button" disabled={!unlocked}
                onClick={() => setFrame(f.key)}
                className={cn(
                  "relative rounded-lg border-2 p-3 flex flex-col items-center gap-2 transition-all min-h-[72px] justify-center",
                  selected ? "border-primary bg-primary/10" : "border-border/40 hover:border-border bg-secondary/20",
                  !unlocked && "opacity-50 cursor-not-allowed",
                )}>
                <NamePlate name={f.key === "none" ? f.name : "Aa"} frame={f.key} variant="compact" animated={false} />
                <span className="text-[11px] text-muted-foreground">{f.name}</span>
                {selected && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
                {!unlocked && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-background/70 text-[10px] text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    {f.desc}
                  </span>
                )}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Өнгө */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Нэрний өнгө</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => {
              const selected = color === c.value
              return (
                <button key={c.label} type="button" title={c.label}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all",
                    selected ? "border-primary scale-110" : "border-border/40 hover:border-border",
                    !c.value && "bg-secondary",
                  )}
                  style={c.value ? { backgroundColor: c.value } : undefined}>
                  {!c.value && <span className="text-[9px] text-muted-foreground">Auto</span>}
                  {selected && c.value && <Check className="h-3.5 w-3.5 text-black/70" />}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Өөрийн өнгө:</span>
            <input type="color" value={color || "#ffffff"} onChange={(e) => setColor(e.target.value)}
              className="h-8 w-12 rounded border border-border/60 bg-transparent cursor-pointer" />
            {color && <code className="text-xs text-muted-foreground">{color}</code>}
          </div>
        </CardContent>
      </Card>

      {/* Фонт */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Фонт</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {FONT_OPTIONS.map((o) => (
            <button key={o.key} type="button" onClick={() => setFont(o.key)}
              className={cn(
                "px-4 py-2 rounded-lg border-2 text-sm transition-all",
                font === o.key ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border text-foreground/80",
              )}
              style={{ fontFamily: o.key === "mono" ? "var(--font-mono)" : o.key === "heading" ? "var(--font-heading)" : undefined }}>
              {o.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Анивчих */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Анивчих хөдөлгөөн</p>
              <p className="text-xs text-muted-foreground">Хүрээний animation асаах/унтраах</p>
            </div>
          </div>
          <button type="button" onClick={() => setAnimated(!animated)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors shrink-0",
              animated ? "bg-primary" : "bg-secondary",
            )}>
            <span className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
              animated ? "translate-x-[22px]" : "translate-x-0.5",
            )} />
          </button>
        </CardContent>
      </Card>

      <Button onClick={save} className="w-full glow-primary" size="lg" disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Хадгалах
      </Button>
    </div>
  )
}
