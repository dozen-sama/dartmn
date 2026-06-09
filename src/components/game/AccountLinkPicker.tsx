"use client"

import { useCallback, useRef, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export interface LinkedAccount { id: string; name: string; username: string }

// DartMN бүртгэлийг @username-ээр хайж тоглогчид холбоно (заавал биш).
export function AccountLinkPicker({ value, onChange, placeholder }: {
  value: LinkedAccount | null
  onChange: (a: LinkedAccount | null) => void
  placeholder?: string
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<LinkedAccount[]>([])
  const [open, setOpen] = useState(false)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((query: string) => {
    setQ(query)
    if (tRef.current) clearTimeout(tRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    tRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from("profiles")
        .select("id, display_name, username")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(6)
      setResults((data ?? []).map((d) => ({ id: d.id, name: d.display_name, username: d.username })))
      setOpen(true)
    }, 250)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/30 rounded-md px-2 py-1">
        <Check className="h-3 w-3 text-primary shrink-0" />
        <span className="truncate text-primary font-medium">@{value.username}</span>
        <button type="button" onClick={() => onChange(null)} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-secondary/40 border border-border/40 rounded-md px-2">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? "DartMN бүртгэл холбох (заавал биш)"}
          className="flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border border-border/60 rounded-md shadow-lg overflow-hidden">
          {results.map((r) => (
            <button key={r.id} type="button"
              onClick={() => { onChange(r); setQ(""); setResults([]); setOpen(false) }}
              className="flex flex-col items-start w-full px-2.5 py-1.5 hover:bg-secondary/60 text-left">
              <span className="text-xs font-medium truncate max-w-full">{r.name}</span>
              <span className="text-[10px] text-muted-foreground">@{r.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
