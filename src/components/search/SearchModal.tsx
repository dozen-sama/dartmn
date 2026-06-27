"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Building2, Loader2, Search, Trophy, Users, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getTier } from "@/lib/rating"
import { PlayerName, COSMETIC_FIELDS } from "@/components/cosmetic/PlayerName"

interface SearchResult {
  type: "player" | "tournament" | "club"
  id: string
  title: string
  subtitle: string
  href: string
  avatar?: string | null
  badge?: string
  cosmetic?: {
    display_name: string
    equipped_frame?: string | null
    name_effect?: string | null
    name_color?: string | null
    name_font?: string | null
    name_animated?: boolean | null
  }
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    const supabase = createClient()
    // PostgREST .or()-д тусгай тэмдэгт (, ( ) * % \ :) орохоос сэргийлж цэвэрлэнэ
    const term = `%${q.replace(/[%,()*\\:]/g, " ").trim()}%`

    const [players, tournaments, clubs] = await Promise.all([
      supabase.from("profiles")
        .select(`id, username, display_name, avatar_url, rating_points, ${COSMETIC_FIELDS}`)
        .or(`username.ilike.${term},display_name.ilike.${term}`)
        .limit(4),
      supabase.from("tournaments")
        .select("id, name, status, format, location")
        .ilike("name", term)
        .neq("status", "cancelled")
        .limit(4),
      supabase.from("clubs")
        .select("id, name, logo_url, city, member_count")
        .ilike("name", term)
        .limit(3),
    ])

    const res: SearchResult[] = [
      ...(players.data ?? []).map((p) => ({
        type: "player" as const,
        id: p.id,
        title: p.display_name,
        subtitle: `@${p.username} · ${p.rating_points} · ${getTier(p.rating_points).tier}`,
        href: `/profile/${p.username}`,
        avatar: p.avatar_url,
        badge: getTier(p.rating_points).icon,
        cosmetic: p,
      })),
      ...(tournaments.data ?? []).map((t) => ({
        type: "tournament" as const,
        id: t.id,
        title: t.name,
        subtitle: `${t.format.toUpperCase()} · ${t.location ?? ""}`,
        href: `/tournaments/${t.id}`,
      })),
      ...(clubs.data ?? []).map((c) => ({
        type: "club" as const,
        id: c.id,
        title: c.name,
        subtitle: `${c.city ?? ""} · ${c.member_count} гишүүн`,
        href: `/clubs/${c.id}`,
        avatar: c.logo_url,
      })),
    ]
    setResults(res)
    setSelected(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      if (e.key === "Enter" && results[selected]) {
        router.push(results[selected].href)
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, results, selected, router, onClose])

  if (!open) return null

  function navigate(href: string) {
    router.push(href)
    onClose()
  }

  const typeIcon = { player: Users, tournament: Trophy, club: Building2 }
  const typeLabel = { player: "Тоглогч", tournament: "Тэмцээн", club: "Клуб" }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Тоглогч, тэмцээн, клуб хайх..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          <button onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {["player", "tournament", "club"].map((type) => {
              const group = results.filter((r) => r.type === type)
              if (group.length === 0) return null
              const Icon = typeIcon[type as keyof typeof typeIcon]
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {typeLabel[type as keyof typeof typeLabel]}
                    </span>
                  </div>
                  {group.map((r) => {
                    const idx = results.indexOf(r)
                    return (
                      <button key={r.id} onClick={() => navigate(r.href)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          idx === selected ? "bg-secondary" : "hover:bg-secondary/60"
                        )}>
                        {/* Avatar or Icon */}
                        {r.avatar ? (
                          <div className="h-8 w-8 rounded-lg overflow-hidden bg-secondary shrink-0">
                            <img src={r.avatar} alt={r.title} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {r.badge && <span className="text-sm">{r.badge}</span>}
                            <p className="text-sm font-medium truncate">
                              {r.cosmetic ? <PlayerName p={r.cosmetic} /> : r.title}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">↵</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">«{query}» — олдсонгүй</p>
          </div>
        ) : query.length === 0 ? (
          <div className="py-8 px-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Хурдан хандах</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Чансаа", href: "/ratings" },
                { label: "Тэмцээн", href: "/tournaments" },
                { label: "Клубууд", href: "/clubs" },
                { label: "Профайл тохиргоо", href: "/settings/profile" },
              ].map((q) => (
                <button key={q.href} onClick={() => navigate(q.href)}
                  className="px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary text-xs font-medium transition-colors">
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="border-t border-border/30 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> навигац</span>
          <span><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">↵</kbd> орох</span>
          <span><kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> хаах</span>
        </div>
      </div>
    </div>
  )
}
