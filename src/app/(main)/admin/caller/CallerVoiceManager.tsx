"use client"

import { useMemo, useRef, useState } from "react"
import { Mic, Square, Upload, Trash2, Play, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { callerKeys } from "@/lib/caller"
import { toast } from "sonner"

type ClipInfo = { ext: string; updated_at: string }

export function CallerVoiceManager({ existing }: { existing: Record<string, ClipInfo> }) {
  const keys = useMemo(() => callerKeys(), [])
  const [clips, setClips] = useState<Record<string, ClipInfo>>(existing)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [recordingKey, setRecordingKey] = useState<string | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const recordedCount = Object.keys(clips).length

  function clipUrl(key: string, info: ClipInfo): string {
    const base = supabase.storage.from("caller-voice").getPublicUrl(`${key}.${info.ext}`).data.publicUrl
    return `${base}?v=${new Date(info.updated_at).getTime()}`
  }

  function preview(key: string, info: ClipInfo) {
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = clipUrl(key, info)
    audioRef.current.play().catch(() => {})
  }

  async function upload(key: string, file: Blob, filename: string) {
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      const fd = new FormData()
      fd.append("key", key)
      fd.append("file", file, filename)
      const res = await fetch("/api/admin/caller", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Алдаа")
      setClips((c) => ({ ...c, [key]: { ext: json.ext, updated_at: new Date().toISOString() } }))
      toast.success(`"${key}" хадгалагдлаа`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload алдаа")
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  async function startRecord(key: string) {
    if (recordingKey) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" })
        await upload(key, blob, `${key}.webm`)
      }
      mrRef.current = mr
      setRecordingKey(key)
      mr.start()
    } catch {
      toast.error("Микрофон нээгдсэнгүй")
    }
  }

  function stopRecord() {
    mrRef.current?.stop()
    mrRef.current = null
    setRecordingKey(null)
  }

  async function del(key: string) {
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      const res = await fetch("/api/admin/caller", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Алдаа")
      setClips((c) => { const n = { ...c }; delete n[key]; return n })
      toast.success("Устгагдлаа")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Устгах алдаа")
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  const phrases = keys.filter((k) => k.group === "phrase")
  const numbers = keys.filter((k) => k.group === "number" && (!onlyMissing || !clips[k.key]))

  function Row({ k, label }: { k: string; label: string }) {
    const info = clips[k]
    const isBusy = busy[k]
    const isRec = recordingKey === k
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/40">
        <span className={cn("h-2 w-2 rounded-full shrink-0", info ? "bg-emerald-500" : "bg-muted-foreground/30")} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground ml-2">{k}</span>
        </div>
        {info && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => preview(k, info)} title="Сонсох">
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-1" />
        ) : isRec ? (
          <Button size="sm" variant="destructive" className="h-7 gap-1" onClick={stopRecord}>
            <Square className="h-3.5 w-3.5" />Зогс
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 gap-1" disabled={!!recordingKey} onClick={() => startRecord(k)}>
            <Mic className="h-3.5 w-3.5" />Бичих
          </Button>
        )}
        <label className={cn("h-7 w-7 inline-flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-secondary", (isBusy || isRec) && "pointer-events-none opacity-40")} title="Файл оруулах">
          <Upload className="h-3.5 w-3.5" />
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (f) upload(k, f, f.name); e.target.value = ""
          }} />
        </label>
        {info && !isBusy && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(k)} title="Устгах">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm">
          <Check className="h-4 w-4 inline text-emerald-500 mr-1" />
          <span className="font-semibold">{recordedCount}</span> / {keys.length} бичигдсэн
        </p>
        <Button size="sm" variant={onlyMissing ? "default" : "outline"} onClick={() => setOnlyMissing((v) => !v)}>
          {onlyMissing ? "Бүгдийг харах" : "Зөвхөн дутууг"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">Фраз</p>
          {phrases.filter((k) => !onlyMissing || !clips[k.key]).map((k) => <Row key={k.key} k={k.key} label={k.label} />)}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">Оноо (1–180)</p>
          <div className="grid sm:grid-cols-2 gap-x-4">
            {numbers.map((k) => <Row key={k.key} k={k.key} label={k.label} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
