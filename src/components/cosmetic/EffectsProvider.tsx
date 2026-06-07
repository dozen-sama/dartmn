"use client"

import { createContext, useContext, useMemo } from "react"
import type { EffectRow } from "@/lib/cosmetics"

const EffectsContext = createContext<Map<string, EffectRow>>(new Map())

/**
 * Идэвхтэй effect-үүдийг (DB-ээс) бүх NamePlate-д хүргэнэ.
 * (main) layout-д серверээс татаж дамжуулна.
 */
export function EffectsProvider({ effects, children }: { effects: EffectRow[]; children: React.ReactNode }) {
  const map = useMemo(() => new Map(effects.map((e) => [e.key, e])), [effects])
  return <EffectsContext.Provider value={map}>{children}</EffectsContext.Provider>
}

export function useCosmeticEffect(key?: string | null): EffectRow | undefined {
  const map = useContext(EffectsContext)
  return key ? map.get(key) : undefined
}
