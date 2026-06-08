"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Check, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClubNamePlate } from "@/components/cosmetic/ClubNamePlate"
import { cn } from "@/lib/utils"

const NEON_COLORS = [
  { label: "Цэнхэр", value: "#34d3ee" },
  { label: "Хөх", value: "#4da3ff" },
  { label: "Нил", value: "#b06cff" },
  { label: "Ягаан", value: "#ff6ec7" },
  { label: "Ногоон", value: "#34d399" },
  { label: "Алт", value: "#f5c542" },
  { label: "Улаан", value: "#ff4d4d" },
  { label: "Улбар шар", value: "#ff8a1f" },
]

export function ClubTagPicker({ clubId, tag, initialColor }: { clubId: string; tag: string | null; initialColor: string | null }) {
  const router = useRouter()
  const [color, setColor] = useState(initialColor ?? "")
  const [saving, setSaving] = useState(false)

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
        <p className="text-xs text-muted-foreground">Сонгосон өнгийг бүх гишүүн нэрнийхээ урд автоматаар зүүнэ</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-5 bg-secondary/20 rounded-lg text-base">
          <ClubNamePlate name={tag || "TAG"} color={color || undefined} />
        </div>
        <div className="flex flex-wrap gap-2">
          {NEON_COLORS.map((c) => (
            <button key={c.value} type="button" title={c.label} onClick={() => setColor(c.value)}
              className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all",
                color === c.value ? "border-foreground scale-110" : "border-border/40 hover:border-border")}
              style={{ backgroundColor: c.value }}>
              {color === c.value && <Check className="h-3.5 w-3.5 text-black/70" />}
            </button>
          ))}
          <input type="color" value={color || "#34d3ee"} onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 rounded border border-border/60 bg-transparent cursor-pointer" title="Өөрийн өнгө" />
        </div>
        <Button onClick={save} disabled={saving} className="w-full" size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Tag өнгө хадгалах
        </Button>
      </CardContent>
    </Card>
  )
}
