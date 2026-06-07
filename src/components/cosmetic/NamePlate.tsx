"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
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

// Зөвхөн харагдаж буй үед true (lazy effect — гүйцэтгэл)
function useInView(ref: { current: HTMLElement | null }, enabled: boolean) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { rootMargin: "120px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref, enabled])
  return inView
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
 * Тоглогч/клубын нэрийг хүрээ + effect + өнгө/фонтоор харуулна.
 * Effect (Lottie) нь зөвхөн харагдаж буй үед (lazy) ачаалагдана.
 */
export function NamePlate({ name, frame, effect, color, font, animated = true, variant = "inline", className }: Props) {
  const def = getFrame(frame)
  const noFrame = !def || def.theme === "none"

  const eff = useCosmeticEffect(effect)
  const hasEffect = !!eff?.lottie_url && animated
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, hasEffect)
  const showEffect = hasEffect && inView

  const style: CSSProperties = {}
  if (color) style.color = color
  if (font && FONT_FAMILY[font]) style.fontFamily = FONT_FAMILY[font]
  const labelStyle = Object.keys(style).length > 0 ? style : undefined

  if (noFrame && !hasEffect) {
    return <span className={className} style={labelStyle}>{name}</span>
  }

  return (
    <span ref={ref} className={cn("np", noFrame ? "np-bare" : `np-${def!.theme}`, `np-${variant}`, hasEffect && variant === "full" && "np-fixed", !animated && "np-static", className)}>
      {showEffect && <EffectLayer file={eff!.lottie_url} fit={eff!.fit} scale={eff!.scale} scaleY={eff!.scale_y} offsetX={eff!.offset_x} offsetY={eff!.offset_y} single={variant !== "full"} />}
      <span className="np-label" style={labelStyle}>{name}</span>
    </span>
  )
}
