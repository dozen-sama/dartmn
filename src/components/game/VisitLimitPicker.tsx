"use client"

import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface VisitLimitPickerProps {
  value: number           // visit тоо (1 visit = 3 дарт)
  onChange: (v: number) => void
  enabled: boolean
  onToggle: (v: boolean) => void
  bullOff?: boolean
  onBullOffToggle?: (v: boolean) => void
  className?: string
}

// Common visit presets
const PRESETS = [5, 7, 10, 15, 20, 25]

export function VisitLimitPicker({
  value,
  onChange,
  enabled,
  onToggle,
  bullOff = false,
  onBullOffToggle,
  className,
}: VisitLimitPickerProps) {
  const totalDarts = value * 3

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={enabled}
          onChange={(e) => { onToggle(e.target.checked); if (!e.target.checked && onBullOffToggle) onBullOffToggle(false) }}
          className="accent-primary" />
        <span className="text-sm font-medium">Сумны хязгаар</span>
      </label>

      {enabled && (
        <div className="pl-4 space-y-3">
          {/* Visual explanation */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: Math.min(value, 8) }).map((_, i) => (
              <div key={i} className="flex items-center gap-0.5">
                {[0,1,2].map(d => (
                  <div key={d} className="h-2 w-2 rounded-full bg-primary/60" />
                ))}
                {i < Math.min(value, 8) - 1 && <span className="text-muted-foreground text-[10px] mx-0.5">+</span>}
              </div>
            ))}
            {value > 8 && (
              <span className="text-xs text-muted-foreground">... +{value - 8} багц</span>
            )}
          </div>

          {/* Stepper + info */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Stepper */}
            <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
              <button type="button" onClick={() => onChange(Math.max(1, value - 1))}
                className="h-9 w-9 flex items-center justify-center hover:bg-secondary text-muted-foreground transition-colors">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <div className="h-9 px-3 flex items-center justify-center border-x border-border/60 bg-secondary/30 min-w-[60px] text-center">
                <span className="text-base font-black">{value}</span>
              </div>
              <button type="button" onClick={() => onChange(Math.min(50, value + 1))}
                className="h-9 w-9 flex items-center justify-center hover:bg-secondary text-muted-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Unit info */}
            <div className="text-sm">
              <span className="font-semibold">{value} багц сум</span>
              <span className="text-muted-foreground mx-1.5">·</span>
              <span className="font-black text-primary">{totalDarts} дарт</span>
              <span className="text-muted-foreground text-xs ml-1">/ тоглогч</span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground self-center mr-1">Хурдан:</span>
            {PRESETS.map(n => (
              <button key={n} type="button" onClick={() => onChange(n)}
                className={cn("px-2 py-0.5 rounded-md text-xs font-semibold border transition-all",
                  value === n
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-border")}>
                {n}v<span className="text-[10px] opacity-60 ml-0.5">/{n * 3}д</span>
              </button>
            ))}
          </div>

          {/* Accumulation visual */}
          <div className="bg-secondary/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Дарт хуримтлал: </span>
            {[1, 2, 3, Math.ceil(value / 2), value].filter((v, i, a) => a.indexOf(v) === i && v <= value).map((v, i) => (
              <span key={v}>
                {i > 0 && <span className="mx-1 opacity-50">→</span>}
                <span className={v === value ? "text-primary font-bold" : ""}>{v * 3}д</span>
              </span>
            ))}
            <span className="ml-1 opacity-50">(= {totalDarts} дарт хүрмэгц)</span>
          </div>

          {/* Bull-off option */}
          {onBullOffToggle && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={bullOff} onChange={(e) => onBullOffToggle(e.target.checked)}
                className="mt-0.5 accent-primary" />
              <div>
                <span className="text-sm">🎯 Сумны хязгаарт хүрэхэд</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {value} багц сум ({totalDarts} дарт) дуусаад хэн ч дуусгаагүй бол Bull-д шидэж хамгийн ойр нь хожно
                </p>
              </div>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
