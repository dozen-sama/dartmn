"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Minus, Plus, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useFFAStore } from "@/lib/local-game/ffa-store"
import { nanoid } from "nanoid"
import { toast } from "sonner"

const FORMATS = [
  { value: "501", label: "501" },
  { value: "301", label: "301" },
  { value: "170", label: "170" },
  { value: "121", label: "121" },
  { value: "custom", label: "Дурын" },
] as const

export function FFASetup() {
  const router = useRouter()
  const createGame = useFFAStore((s) => s.createGame)

  const [name, setName] = useState("Олуулаа тоглох")
  const [format, setFormat] = useState<"501" | "301" | "170" | "121" | "custom">("501")
  const [customScore, setCustomScore] = useState("")
  const [firstTo, setFirstTo] = useState(2)
  const [doubleOut, setDoubleOut] = useState(true)
  const [doubleIn, setDoubleIn] = useState(false)
  const [players, setPlayers] = useState([
    { id: nanoid(4), name: "" },
    { id: nanoid(4), name: "" },
  ])

  const startScore = format === "custom" ? parseInt(customScore) || 0 : parseInt(format)

  function addPlayer() {
    if (players.length >= 10) return
    setPlayers((p) => [...p, { id: nanoid(4), name: "" }])
  }

  function removePlayer(id: string) {
    if (players.length <= 2) return
    setPlayers((p) => p.filter((pl) => pl.id !== id))
  }

  function updatePlayer(id: string, name: string) {
    setPlayers((p) => p.map((pl) => pl.id === id ? { ...pl, name } : pl))
  }

  function handleCreate() {
    if (!name.trim()) return toast.error("Тоглолтын нэр оруулна уу")
    if (format === "custom" && (startScore < 2 || startScore > 9999)) return toast.error("Оноог 2-9999 хооронд оруулна уу")
    const filled = players.filter((p) => p.name.trim())
    if (filled.length < 2) return toast.error("Хамгийн багадаа 2 тоглогч байх ёстой")

    const gameId = createGame({
      name: name.trim(),
      format,
      startScore,
      players: filled.map((p) => p.name.trim()),
      firstTo,
      doubleOut,
      doubleIn,
      joinCode: nanoid(6).toUpperCase(),
      joinPassword: "",
    })

    try {
      const owned = JSON.parse(localStorage.getItem("owned-ffa") ?? "[]") as string[]
      localStorage.setItem("owned-ffa", JSON.stringify([...owned, gameId]))
    } catch {}

    router.push(`/local/ffa/${gameId}`)
  }

  return (
    <div className="max-w-md mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3 border-b border-border/50 pb-3">
        <button onClick={() => router.push("/local")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold text-lg">{name.trim() || "Олуулаа тоглох"}</h1>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Нэр</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              className="bg-secondary/50 border-border/60" placeholder="Тоглолтын нэр" />
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label>Формат</Label>
            <div className="flex gap-2 flex-wrap">
              {FORMATS.map((f) => (
                <button key={f.value} onClick={() => setFormat(f.value)}
                  className={cn("px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all",
                    format === f.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border")}>
                  {f.label}
                </button>
              ))}
            </div>
            {format === "custom" && (
              <Input
                type="number"
                value={customScore}
                onChange={(e) => setCustomScore(e.target.value)}
                placeholder="Эхлэх оноо (жиш: 701, 1001...)"
                className="bg-secondary/50 border-border/60 mt-2"
                min={2}
                max={9999}
              />
            )}
          </div>

          {/* First to */}
          <div className="space-y-1.5">
            <Label>First to (leg)</Label>
            <div className="flex items-center gap-3">
              <button onClick={() => setFirstTo((n) => Math.max(1, n - 1))}
                className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-secondary">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-bold text-lg score-display">{firstTo}</span>
              <button onClick={() => setFirstTo((n) => Math.min(9, n + 1))}
                className="h-9 w-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-secondary">
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">leg хожсон тоглогч ялна</span>
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <Label>Дүрэм</Label>
            <div className="flex gap-4">
              {[
                { label: "Double out", val: doubleOut, set: setDoubleOut },
                { label: "Double in", val: doubleIn, set: setDoubleIn },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="accent-primary" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Players */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Тоглогчид ({players.length}/10)</Label>
            <button onClick={addPlayer} disabled={players.length >= 10}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed">
              <UserPlus className="h-4 w-4" />
              Нэмэх
            </button>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                <Input
                  value={p.name}
                  onChange={(e) => updatePlayer(p.id, e.target.value)}
                  placeholder={`Тоглогч ${i + 1}`}
                  className="bg-secondary/50 border-border/60 h-9"
                  onKeyDown={(e) => { if (e.key === "Enter" && players.length < 10) addPlayer() }}
                />
                <button onClick={() => removePlayer(p.id)} disabled={players.length <= 2}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Тэмцэгчид тоглолтод нэмэгдсэн дарааллаар ээлжилнэ
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleCreate} className="w-full glow-primary">
        Тоглолт эхлүүлэх →
      </Button>
    </div>
  )
}
