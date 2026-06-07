"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { getFrame } from "@/lib/frames"
import { useCosmeticEffect } from "./EffectsProvider"
import { EffectLayer } from "./FireFrame"

// Сонгож болох фонтууд (customize)
export const FONT_FAMILY: Record<string, string> = {
  sans: "var(--font-sans), sans-serif",
  oswald: "var(--font-oswald), sans-serif",
  russo: "var(--font-russo), sans-serif",
  montserrat: "var(--font-montserrat), sans-serif",
  rubik: "var(--font-rubik), sans-serif",
  exo2: "var(--font-exo2), sans-serif",
  mono: "var(--font-mono), monospace",
}

interface Props {
  name: string
  frame?: string | null
  effect?: string | null
  color?: string | null
  font?: string | null
  animated?: boolean
  variant?: "full" | "compact" | "inline"
  className?: string
}

/**
 * Тоглогч/клубын нэрийг сонгосон хүрээ + effect + өнгө/фонт/анивчилтаар харуулна.
 * Effect-ийн render тохиргоо EffectsProvider (DB)-ээс ирнэ.
 */
export function NamePlate({ name, frame, effect, color, font, animated = true, variant = "inline", className }: Props) {
  const def = getFrame(frame)
  const noFrame = !def || def.theme === "none"

  const eff = useCosmeticEffect(effect)
  const showEffect = variant === "full" && !!eff?.lottie_url && animated

  const style: CSSProperties = {}
  if (color) style.color = color
  if (font && FONT_FAMILY[font]) style.fontFamily = FONT_FAMILY[font]
  const labelStyle = Object.keys(style).length > 0 ? style : undefined

  if (noFrame && !showEffect) {
    return <span className={className} style={labelStyle}>{name}</span>
  }

  return (
    <span className={cn("np", noFrame ? "np-bare" : `np-${def!.theme}`, `np-${variant}`, !animated && "np-static", className)}>
      {showEffect && <EffectLayer file={eff!.lottie_url} fit={eff!.fit} scale={eff!.scale} />}
      <span className="np-label" style={labelStyle}>{name}</span>
    </span>
  )
}
