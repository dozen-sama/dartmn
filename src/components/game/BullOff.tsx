"use client"

import { useState } from "react"
import { Check, Shuffle, Target } from "lucide-react"
import { cn } from "@/lib/utils"

interface Player {
  id: string
  name: string
  teamName?: string
}

interface BullOffProps {
  players: Player[]
  onSelect: (winnerId: string) => void
  /**
   * "start" — тоглолт эхлэхийн өмнө хэн эхэлхийг тодорхойлно
   * "win"   — limit round-д хүрмэгц хэн leg хожихыг тодорхойлно
   */
  purpose?: "start" | "win"
}

export function BullOff({ players, onSelect, purpose = "start" }: BullOffProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const isWin = purpose === "win"

  const title = isWin
    ? "Бухандаа шид — хэн хамгийн ойр?"
    : "Бухандаа шид — хэн эхлэх вэ?"

  const subtitle = isWin
    ? "Тоглогч бүр нэг сум шидэнэ. Бух-д хамгийн ойр шидсэн нь leg-ийг хожно."
    : "Тоглогч бүр нэг сум шидэнэ. Бух-д хамгийн ойр шидсэн нь эхэлнэ."

  const confirmLabel = isWin ? "Хожигч болгох →" : "Тоглолт эхэлнэ →"

  function confirm() {
    if (selected) onSelect(selected)
  }

  function random() {
    const r = players[Math.floor(Math.random() * players.length)]
    setSelected(r.id)
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Dartboard SVG */}
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-lg">
          {[70, 58, 44, 28, 14, 7].map((r, i) => (
            <circle key={r} cx="70" cy="70" r={r}
              fill={i % 2 === 0 ? "#1a1a2e" : "#2a1a1a"}
              stroke="#333" strokeWidth="0.5" />
          ))}
          <circle cx="70" cy="70" r="7" fill="#dc2626" />
          <circle cx="70" cy="70" r="3.5" fill="#1a1a2e" />
          {players.map((p, i) => {
            const isSelected = selected === p.id
            const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2
            const dist = isSelected ? 6 : 18 + i * 8
            const x = 70 + dist * Math.cos(angle)
            const y = 70 + dist * Math.sin(angle)
            const colors = ["#e11d48", "#3b82f6", "#f59e0b", "#22c55e"]
            return (
              <g key={p.id}>
                <circle cx={x} cy={y} r={isSelected ? 5 : 4}
                  fill={isSelected ? "#22c55e" : colors[i % colors.length]}
                  opacity={isSelected ? 1 : 0.7}
                  style={{ transition: "all 0.4s" }} />
              </g>
            )
          })}
        </svg>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <span className="text-[10px] text-muted-foreground bg-background px-1 rounded">Bull</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-1 px-2">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">{subtitle}</p>
      </div>

      {/* Rule note */}
      <div className="w-full max-w-xs bg-secondary/30 rounded-xl px-4 py-2.5 space-y-1 text-xs text-muted-foreground">
        <p>• Тоглогч бүр <strong className="text-foreground">нэг</strong> сум шиднэ</p>
        <p>• Бух (Bull) = 50 мм, Half Bull = 25 мм</p>
        <p>• <strong className="text-foreground">Хамгийн ойр</strong> шидсэн нь {isWin ? "leg хожно" : "эхэлнэ"}</p>
        {!isWin && <p>• Хоёулан Bull оносон бол дахин шиднэ</p>}
      </div>

      {/* Player selection */}
      <div className="w-full max-w-xs space-y-2">
        <p className="text-[11px] text-muted-foreground text-center uppercase tracking-wide font-medium">
          Хэн хамгийн ойр шидэв?
        </p>
        {players.map((p, i) => {
          const isSelected = selected === p.id
          const borderColors = [
            "border-primary/40 data-[selected=true]:border-primary data-[selected=true]:bg-primary/10",
            "border-blue-500/40 data-[selected=true]:border-blue-500 data-[selected=true]:bg-blue-500/10",
            "border-yellow-500/40 data-[selected=true]:border-yellow-500 data-[selected=true]:bg-yellow-500/10",
            "border-green-500/40 data-[selected=true]:border-green-500 data-[selected=true]:bg-green-500/10",
          ]
          const textColors = ["text-primary", "text-blue-400", "text-yellow-400", "text-green-400"]

          return (
            <button key={p.id} onClick={() => setSelected(p.id)}
              data-selected={isSelected}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left bg-secondary/20",
                borderColors[i % borderColors.length]
              )}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                isSelected ? "bg-green-500 text-white" : "bg-secondary/60 text-muted-foreground"
              )}>
                {isSelected ? <Check className="h-4 w-4" /> : <Target className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                {p.teamName && <p className="text-[10px] text-muted-foreground">{p.teamName}</p>}
                <p className={cn("text-sm font-semibold truncate", isSelected ? textColors[i % textColors.length] : "")}>
                  {p.name}
                </p>
              </div>
              {isSelected && (
                <span className={cn("text-xs font-bold shrink-0", isWin ? "text-green-400" : "text-primary")}>
                  {isWin ? "Ойр ✓" : "Эхэлнэ ✓"}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={random}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/60 text-sm hover:bg-secondary transition-colors">
          <Shuffle className="h-4 w-4" />
          Санамсаргүй
        </button>
        <button onClick={confirm} disabled={!selected}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-40 disabled:cursor-not-allowed">
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
