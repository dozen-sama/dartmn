"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Check, Save, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClubNamePlate } from "@/components/cosmetic/ClubNamePlate"
import { CLUB_TAG_COLORS, CLUB_TIERS, clubTierIndex } from "@/lib/club-tier"
import { cn } from "@/lib/utils"

export function ClubTagPicker({ clubId, tag, initialColor, clubScore = 0 }: { clubId: string; tag: string | null; initialColor: string | null; clubScore?: number }) {
  const router = useRouter()
  const [color, setColor] = useState(initialColor ?? "")
  const [saving, setSaving] = useState(false)
  const myTier = clubTierIndex(clubScore)

  async function save() {
    setSaving(true)
    const res = await fetch("/api/clubs/tag", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ club_id: clubId, tag_color: color || null }),
    })
    if (res.ok) { toast.success("Клубын tag шинэчлэгдлээ — бүх гишүүнд тарлаа"); router.refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "Алдаа") }
    setSaving(false)
  }

  return (
    <Card className="border-primary/20 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">✨ Клубын tag өнгө</CardTitle>
        <p className="text-xs text-muted-foreground">Сонгосон өнгийг бүх гишүүн нэрнийхээ урд автоматаар зүүнэ. <span className="text-primary/80">Клубын цол ахих тусам шинэ өнгө нээгдэнэ.</span></p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-5 bg-secondary/20 rounded-lg text-base">
          <ClubNamePlate name={tag || "TAG"} color={color || undefined} />
        </div>
        <div className="flex flex-wrap gap-2">
          {CLUB_TAG_COLORS.map((c) => {
            const locked = c.tier > myTier
            return (
              <button key={c.value} type="button" disabled={locked} title={locked ? `${CLUB_TIERS[c.tier]?.name} цолд нээгдэнэ` : c.label}
                onClick={() => setColor(c.value)}
                className={cn("relative h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all",
                  color === c.value ? "border-foreground scale-110" : "border-border/40 hover:border-border",
                  locked && "opacity-40 cursor-not-allowed")}
                style={{ backgroundColor: c.value }}>
                {color === c.value && !locked && <Check className="h-3.5 w-3.5 text-black/70" />}
                {locked && <Lock className="h-3 w-3 text-black/60" />}
              </button>
            )
          })}
        </div>
        <Button onClick={save} disabled={saving} className="w-full" size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Tag өнгө хадгалах
        </Button>
      </CardContent>
    </Card>
  )
}
