"use client"

import { useState } from "react"
import { Check, Shuffle, Target } from "lucide-react"
import { cn } from "@/lib/utils"

interface Player {
  id: string
  name: string
  teamName?: string
  color?: string
}

interface BullOffProps {
  players: Player[]       // Тоглогч эсвэл баг бүр нэг оролцогч
  onSelect: (starterId: string) => void
  title?: string
}

export function BullOff({ players, onSelect, title = "Хэн эхлэх вэ?" }: BullOffProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [hoveredBull, setHoveredBull] = useState<number | null>(null)

  function confirm() {
    if (selected) onSelect(selected)
  }

  function random() {
    const r = players[Math.floor(Math.random() * players.length)]
    setSelected(r.id)
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Bull graphic */}
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-lg">
          {/* Dartboard rings */}
          {[70, 58, 44, 28, 14, 7].map((r, i) => (
            <circle key={r} cx="70" cy="70" r={r}
              fill={i % 2 === 0 ? "#1a1a2e" : "#2a1a1a"}
              stroke="#333" strokeWidth="0.5" />
          ))}
          {/* Bull */}
          <circle cx="70" cy="70" r="7" fill="#dc2626" />
          <circle cx="70" cy="70" r="3.5" fill="#1a1a2e" />
          {/* Player dart indicators */}
          {players.map((p, i) => {
            const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2
            const r = selected === p.id ? 8 : 20 + i * 6
            const x = 70 + r * Math.cos(angle)
            const y = 70 + r * Math.sin(angle)
            return (
              <g key={p.id}>
                <circle cx={x} cy={y} r={selected === p.id ? 5 : 4}
                  fill={selected === p.id ? "#22c55e" : p.color ?? "#6366f1"}
                  className="transition-all duration-500" />
                {selected === p.id && (
                  <circle cx={x} cy={y} r="8" fill="none" stroke="#22c55e" strokeWidth="1.5"
                    className="animate-ping" style={{ animationDuration: "1.5s" }} />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Bull-д хамгийн ойр шидсэн тоглогч/баг эхэлнэ
        </p>
      </div>

      {/* Player/team selection */}
      <div className="w-full max-w-xs space-y-2">
        {players.map((p, i) => {
          const isSelected = selected === p.id
          const colors = [
            "border-primary/40 bg-primary/5 data-[selected=true]:border-primary data-[selected=true]:bg-primary/15",
            "border-blue-500/40 bg-blue-500/5 data-[selected=true]:border-blue-500 data-[selected=true]:bg-blue-500/15",
            "border-yellow-500/40 bg-yellow-500/5 data-[selected=true]:border-yellow-500 data-[selected=true]:bg-yellow-500/15",
            "border-green-500/40 bg-green-500/5 data-[selected=true]:border-green-500 data-[selected=true]:bg-green-500/15",
          ]
          const textColors = ["text-primary", "text-blue-400", "text-yellow-400", "text-green-400"]

          return (
            <button key={p.id} onClick={() => setSelected(p.id)}
              data-selected={isSelected}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                colors[i % colors.length]
              )}>
              {/* Bull icon */}
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-black shrink-0",
                isSelected ? "bg-green-500 text-white" : "bg-secondary/60 text-muted-foreground")}>
                {isSelected ? <Check className="h-4 w-4" /> : <Target className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                {p.teamName && <p className="text-[10px] text-muted-foreground">{p.teamName}</p>}
                <p className={cn("text-sm font-semibold truncate", isSelected ? textColors[i % textColors.length] : "")}>
                  {p.name}
                </p>
              </div>
              {isSelected && (
                <span className="text-xs font-bold text-green-400 shrink-0">Эхэлнэ ✓</span>
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
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Тоглолт эхэлнэ →
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        💡 Keyboard shortcut: тоглогчийн дугаар дарна (1, 2, 3...)
      </p>
    </div>
  )
}
