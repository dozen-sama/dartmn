"use client"

import { useCallback, useEffect, useState } from "react"
import {
  announceTurn, initCallerVoices, callerSupported, loadCallerClips,
  getCallerEnabled, setCallerEnabled, type CallArgs,
} from "@/lib/caller"

// Scoreboard-уудад зориулсан дуут caller hook. enabled төлвийг localStorage-оос
// уншиж, зөвхөн асаалттай үед дуудна. Бүх x01 scoreboard-д дахин ашиглагдана.
export function useCaller() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(callerSupported())
    initCallerVoices()
    loadCallerClips()           // хүний бичлэгийн manifest (байвал)
    setEnabled(getCallerEnabled())
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      setCallerEnabled(next)
      return next
    })
  }, [])

  const announce = useCallback((args: CallArgs) => {
    if (enabled) announceTurn(args)
  }, [enabled])

  return { enabled, supported, toggle, announce }
}
