"use client"

import { useEffect } from "react"

interface Options {
  onInput: (digit: string) => void
  onDelete: () => void
  onClear: () => void
  onSubmit: () => void
  enabled?: boolean
}

export function useScoreboardKeyboard({ onInput, onDelete, onClear, onSubmit, enabled = true }: Options) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea") return

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault()
        onInput(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        onDelete()
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        e.preventDefault()
        onClear()
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onSubmit()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onInput, onDelete, onClear, onSubmit, enabled])
}
