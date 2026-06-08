"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, Loader2, Save, Check, Sparkles, Zap, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NamePlate, FONT_FAMILY } from "@/components/cosmetic/NamePlate"
import { PROFILE_FRAMES, COLOR_PRESETS, FONT_OPTIONS } from "@/lib/frames"
import { effectState, spentXp, type EffectRow } from "@/lib/cosmetics"
import { cn } from "@/lib/utils"

type EffectWithPass = EffectRow & { passActive: boolean }

interface Props {
  displayName: string
  initial: { frame: string | null; effect: string | null; color: string | null; font: string | null; animated: boolean }
  unlock: { rating: number; isPremium: boolean }
  xp: number
  ownedEffects: string[]
  unlockedFrames: string[]
  effects: EffectWithPass[]
}

export function NameplateCustomizer({ displayName, initial, unlock, xp, ownedEffects, unlockedFrames, effects }: Props) {
  const router = useRouter()
  const [frame, setFrame] = useState(initial.frame ?? "none")
  const [effect, setEffect] = useState(initial.effect ?? "none")
  const [color, setColor] = useState(initial.color ?? "")
  const [font, setFont] = useState(initial.font ?? "")
  const [animated, setAnimated] = useState(initial.animated)
  const [owned, setOwned] = useState<Set<string>>(new Set(ownedEffects))
  const [saving, setSaving] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  const available = xp - spentXp([...owned], effects)

  async function save() {
    setSaving(true)
    const res = await fetch("/api/cosmetics/equip", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame, effect, color, font, animated }),
    })
    if (res.ok) { toast.success("Нэрийн хээ хадгалагдлаа!"); router.refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Алдаа гарлаа") }
    setSaving(false)
  }

  async function claim(key: string) {
    setUnlocking(key)
    const res = await fetch("/api/cosmetics/unlock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_key: key }),
    })
    if (res.ok) { setOwned((prev) => new Set(prev).add(key)); toast.success("Effect нээгдлээ! 🎉") }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Нээхэд алдаа") }
    setUnlocking(null)
  }

  return (
    <div className="space-y-5">
      {/* Урьдчилан харах */}
      <Card className="border-primary/20 bg-card/80">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm">Урьдчилан харах</CardTitle>
          <span className="text-xs text-muted-foreground flex items-center gap-1" title="Боломжит / Нийт олсон XP">
            <Zap className="h-3.5 w-3.5 text-yellow-400" /> {Math.max(0, available).toLocaleString()} / {xp.toLocaleString()} XP
          </span>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10 bg-secondary/20 rounded-b-lg">
          <div className="text-2xl">
            <NamePlate name={displayName} frame={frame} effect={effect} color={color} font={font} animated={animated} variant="full" />
          </div>
        </CardContent>
      </Card>

      {/* Хүрээ */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Хүрээ сонгох</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PROFILE_FRAMES.map((f) => {
            const unlocked = f.key === "none" || unlockedFrames.includes(f.key)
            const selected = frame === f.key
            return (
              <button key={f.key} type="button" disabled={!unlocked} onClick={() => setFrame(f.key)}
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
                    <Lock className="h-3.5 w-3.5" /> {f.desc}
                  </span>
                )}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Effect (animation) — дэлгүүр/pass */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Animation effect</CardTitle>
          <p className="text-xs text-muted-foreground">XP-ээ зарцуулж нээ. Нэг удаа нээвэл насан туршдаа. Дарж урьдчилан харж болно.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* Байхгүй */}
          <button type="button" onClick={() => setEffect("none")}
            className={cn("relative rounded-lg border-2 p-2.5 text-sm font-medium min-h-[66px] text-left",
              effect === "none" ? "border-primary bg-primary/10 text-primary" : "border-border/40 bg-secondary/20")}>
            Байхгүй
            {effect === "none" && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
          </button>

          {effects.map((e) => {
            const st = effectState(e, { owned: owned.has(e.key), isPremium: unlock.isPremium, available, passActive: e.passActive })
            const selected = effect === e.key
            return (
              <div key={e.key}
                className={cn("relative rounded-lg border-2 p-2.5 flex flex-col gap-1.5 min-h-[66px]",
                  selected ? "border-primary bg-primary/10" : "border-border/40 bg-secondary/20")}>
                <button type="button" onClick={() => setEffect(e.key)} className="text-left flex-1">
                  <span className="text-sm font-medium">{e.name}</span>
                  {selected && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
                  <span className="block text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5 text-yellow-400" />{e.xp} XP
                  </span>
                </button>
                {st === "owned" && (
                  <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Check className="h-3 w-3" />Нээгдсэн</span>
                )}
                {st === "claimable" && (
                  <button type="button" disabled={unlocking === e.key} onClick={() => claim(e.key)}
                    className="text-[11px] rounded bg-primary/20 text-primary px-2 py-1 hover:bg-primary/30 transition-colors flex items-center justify-center gap-1">
                    {unlocking === e.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Нээх
                  </button>
                )}
                {st === "need_xp" && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Lock className="h-3 w-3" />XP {Math.max(0, available)}/{e.xp}</span>
                )}
                {st === "need_sub" && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><Lock className="h-3 w-3" />Subscription</span>
                )}
                {st === "pass_closed" && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><CalendarClock className="h-3 w-3" />Хаагдсан</span>
                )}
              </div>
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
                <button key={c.label} type="button" title={c.label} onClick={() => setColor(c.value)}
                  className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all",
                    selected ? "border-primary scale-110" : "border-border/40 hover:border-border", !c.value && "bg-secondary")}
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
              className={cn("px-4 py-2 rounded-lg border-2 text-sm transition-all",
                font === o.key ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border text-foreground/80")}
              style={{ fontFamily: FONT_FAMILY[o.key] }}>
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
              <p className="text-xs text-muted-foreground">Унтраавал effect хөдөлгөөнгүй (static) харагдана</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={animated} onClick={() => setAnimated(!animated)}
            className={cn("relative h-6 w-11 rounded-full transition-colors shrink-0", animated ? "bg-primary" : "bg-secondary")}>
            <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", animated ? "translate-x-5" : "translate-x-0")} />
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
