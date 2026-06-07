"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Upload, Save, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EffectLayer } from "@/components/cosmetic/FireFrame"
import { cn } from "@/lib/utils"

type Fit = "cover" | "contain" | "stretch"

interface Pass { id: string; name: string; starts_at: string | null; ends_at: string | null }
interface Effect {
  id: string; key: string; name: string; lottie_url: string; xp: number
  fit: string; scale: number; scope: string; pass_id: string | null; sort_order: number; is_active: boolean
}

const FIT_OPTIONS = ["cover", "contain", "stretch"]
const toLocal = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16) : "")

export function AdminCosmetics({ passes, effects }: { passes: Pass[]; effects: Effect[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Pass form
  const [passName, setPassName] = useState("")
  const [passStart, setPassStart] = useState("")
  const [passEnd, setPassEnd] = useState("")

  // Effect нэмэх form
  const [eName, setEName] = useState("")
  const [eKey, setEKey] = useState("")
  const [eXp, setEXp] = useState(500)
  const [eFit, setEFit] = useState("cover")
  const [eScale, setEScale] = useState(1)
  const [ePass, setEPass] = useState("")
  const [eFile, setEFile] = useState<string | null>(null)

  // Effect local edit state — numeric багана supabase-аас string ирдэг тул тоо болгоно
  const [rows, setRows] = useState<Effect[]>(
    effects.map((e) => ({ ...e, xp: Number(e.xp), scale: Number(e.scale), sort_order: Number(e.sort_order) }))
  )
  const [previewKey, setPreviewKey] = useState<string | null>(rows[0]?.key ?? null)
  const preview = rows.find((r) => r.key === previewKey) ?? null

  async function createPass() {
    if (!passName.trim()) return toast.error("Нэр оруул")
    setBusy(true)
    const res = await fetch("/api/admin/cosmetics/pass", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: passName, starts_at: passStart || null, ends_at: passEnd || null }),
    })
    if (res.ok) { toast.success("Pass үүслээ"); setPassName(""); setPassStart(""); setPassEnd(""); router.refresh() }
    else toast.error((await res.json().catch(() => ({})))?.error ?? "Алдаа")
    setBusy(false)
  }

  async function deletePass(id: string) {
    if (!confirm("Pass устгах уу?")) return
    await fetch("/api/admin/cosmetics/pass", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    router.refresh()
  }

  async function readFile(f: File) {
    const txt = await f.text()
    try { JSON.parse(txt); setEFile(txt); toast.success(`Файл уншигдлаа (${(f.size / 1024).toFixed(0)}KB)`) }
    catch { toast.error("Буруу JSON файл") }
  }

  async function addEffect() {
    if (!eName.trim() || !eKey.trim()) return toast.error("Нэр, key оруул")
    if (!eFile) return toast.error("Lottie файл сонго")
    setBusy(true)
    const res = await fetch("/api/admin/cosmetics/effect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: eKey.trim(), name: eName.trim(), xp: eXp, fit: eFit, scale: eScale, pass_id: ePass || null, lottie_text: eFile }),
    })
    if (res.ok) {
      toast.success("Effect нэмэгдлээ"); setEName(""); setEKey(""); setEFile(null); router.refresh()
    } else toast.error((await res.json().catch(() => ({})))?.error ?? "Алдаа")
    setBusy(false)
  }

  function patchRow(id: string, patch: Partial<Effect>) {
    setRows((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x))
  }

  async function saveRow(e: Effect) {
    setBusy(true)
    const res = await fetch("/api/admin/cosmetics/effect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, key: e.key, name: e.name, xp: e.xp, fit: e.fit, scale: e.scale, scope: e.scope, pass_id: e.pass_id, sort_order: e.sort_order, is_active: e.is_active }),
    })
    if (res.ok) { toast.success("Хадгалагдлаа"); router.refresh() } else toast.error("Алдаа")
    setBusy(false)
  }

  async function deleteEffect(id: string) {
    if (!confirm("Effect устгах уу?")) return
    await fetch("/api/admin/cosmetics/effect", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Pass-ууд */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Pass (сезон) үүсгэх</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input placeholder="Нэр (ж: Season 1)" value={passName} onChange={(e) => setPassName(e.target.value)} className="bg-secondary/50" />
            <input type="datetime-local" value={passStart} onChange={(e) => setPassStart(e.target.value)} className="rounded-md bg-secondary/50 border border-border/60 px-2 text-sm" />
            <input type="datetime-local" value={passEnd} onChange={(e) => setPassEnd(e.target.value)} className="rounded-md bg-secondary/50 border border-border/60 px-2 text-sm" />
            <Button onClick={createPass} disabled={busy}><Plus className="h-4 w-4 mr-1" />Нэмэх</Button>
          </div>
          <div className="space-y-1.5">
            {passes.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm bg-secondary/20 rounded px-3 py-2">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{toLocal(p.starts_at) || "—"} → {toLocal(p.ends_at) || "∞"}</span>
                <button onClick={() => deletePass(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {passes.length === 0 && <p className="text-xs text-muted-foreground">Pass байхгүй (effect-үүд үргэлж нээлттэй)</p>}
          </div>
        </CardContent>
      </Card>

      {/* Effect нэмэх */}
      <Card className="border-primary/20 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Шинэ effect нэмэх</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Input placeholder="Нэр" value={eName} onChange={(e) => setEName(e.target.value)} className="bg-secondary/50" />
          <Input placeholder="key (англиар, давхцахгүй)" value={eKey} onChange={(e) => setEKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="bg-secondary/50" />
          <Input type="number" placeholder="XP үнэ" value={eXp} onChange={(e) => setEXp(+e.target.value)} className="bg-secondary/50" />
          <select value={eFit} onChange={(e) => setEFit(e.target.value)} className="rounded-md bg-secondary/50 border border-border/60 px-2 text-sm">
            {FIT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <Input type="number" step="0.1" placeholder="Хэмжээ (scale)" value={eScale} onChange={(e) => setEScale(+e.target.value)} className="bg-secondary/50" />
          <select value={ePass} onChange={(e) => setEPass(e.target.value)} className="rounded-md bg-secondary/50 border border-border/60 px-2 text-sm">
            <option value="">Pass-гүй (үргэлж)</option>
            {passes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className={cn("col-span-2 sm:col-span-2 flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-sm cursor-pointer", eFile && "border-green-500/50 text-green-400")}>
            <Upload className="h-4 w-4" />
            {eFile ? "Файл бэлэн ✓ (дахин сонгож болно)" : "Lottie JSON файл сонгох"}
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          <Button onClick={addEffect} disabled={busy} className="glow-primary">
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Нэмэх
          </Button>
        </CardContent>
      </Card>

      {/* Effect жагсаалт — засах */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Effect-үүд ({rows.length}) — fit/scale/xp тааруулах</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {/* Шууд preview — 👁 дарж сонгосон effect, fit/scale-ийг шууд харна */}
          {preview && (
            <div className="flex flex-col items-center gap-1 py-6 bg-secondary/20 rounded-lg sticky top-2 z-10 border border-border/40">
              <span className="np np-bare np-full text-2xl">
                <EffectLayer key={preview.lottie_url} file={preview.lottie_url} fit={preview.fit as Fit} scale={Number(preview.scale)} />
                <span className="np-label">{preview.name}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">{preview.name} · fit: {preview.fit} · scale: {preview.scale}</span>
            </div>
          )}
          {rows.map((e) => (
            <div key={e.id} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-center bg-secondary/20 rounded px-2 py-2 text-sm">
              <span className="font-medium truncate">{e.name}<span className="text-[10px] text-muted-foreground ml-1">{e.key}</span></span>
              <label className="text-xs text-muted-foreground">XP<Input type="number" value={e.xp} onChange={(ev) => patchRow(e.id, { xp: +ev.target.value })} className="bg-secondary/50 h-8" /></label>
              <label className="text-xs text-muted-foreground">fit
                <select value={e.fit} onChange={(ev) => patchRow(e.id, { fit: ev.target.value })} className="w-full rounded bg-secondary/50 border border-border/60 h-8 text-sm">
                  {FIT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">scale<Input type="number" step="0.1" value={e.scale} onChange={(ev) => patchRow(e.id, { scale: +ev.target.value })} className="bg-secondary/50 h-8" /></label>
              <label className="text-xs text-muted-foreground">pass
                <select value={e.pass_id ?? ""} onChange={(ev) => patchRow(e.id, { pass_id: ev.target.value || null })} className="w-full rounded bg-secondary/50 border border-border/60 h-8 text-sm">
                  <option value="">үргэлж</option>
                  {passes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mt-4">
                <input type="checkbox" checked={e.is_active} onChange={(ev) => patchRow(e.id, { is_active: ev.target.checked })} />идэвхтэй
              </label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPreviewKey(e.key)} className={cn(previewKey === e.key && "border-primary text-primary")}><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => saveRow(e)} disabled={busy}><Save className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => deleteEffect(e.id)} className="text-destructive border-destructive/30"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
