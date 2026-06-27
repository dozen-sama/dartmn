"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Target, Trophy } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlayerName } from "@/components/cosmetic/PlayerName"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { mn } from "@/locales/mn"
import { Profile } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getTier } from "@/lib/rating"
import { SearchModal } from "@/components/search/SearchModal"
import { NotificationPanel } from "@/components/notifications/NotificationPanel"

interface NavbarProps {
  profile: Profile | null
}

export function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success(mn.auth.logoutSuccess)
    router.push("/login")
    router.refresh()
  }

  const tier = profile ? getTier(profile.rating_points) : null

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary glow-primary">
              <Target className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden font-bold text-lg sm:block">
              Dart<span className="text-primary">MN</span>
            </span>
          </Link>

          {/* Search bar — desktop */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Хайх...</span>
            <kbd className="hidden sm:inline text-[10px] border border-border/60 rounded px-1.5 py-0.5 bg-background">⌘K</kbd>
          </button>

          <div className="flex-1 md:hidden" />

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Search icon — mobile */}
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>

            {profile ? (
              <>
                {/* Notifications */}
                <NotificationPanel userId={profile.id} />

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary transition-colors">
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                        {profile.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start min-w-0">
                      <span className="text-xs font-semibold truncate max-w-[120px]"><PlayerName p={profile} /></span>
                      {tier && (
                        <span className={cn("text-[10px] font-medium", tier.color)}>
                          {tier.icon} {tier.tier}
                        </span>
                      )}
                    </div>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-60">
                    {/* Profile header */}
                    <div className="px-3 py-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-border">
                          <AvatarImage src={profile.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {profile.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate"><PlayerName p={profile} /></p>
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Trophy className="h-3 w-3 text-[oklch(0.78_0.16_85)]" />
                            <span className="text-xs font-semibold text-[oklch(0.78_0.16_85)]">{profile.rating_points}</span>
                            {tier && <span className={cn("text-[10px]", tier.color)}>{tier.icon} {tier.tier}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <DropdownMenuItem onClick={() => router.push(`/profile/${profile.username}`)}>
                      Профайл харах
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
                      Профайл засах
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/stats")}>
                      Миний статистик
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/pricing")}>
                      Subscription
                    </DropdownMenuItem>

                    {profile.role === "admin" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/admin")}>
                          Админ хяналт самбар
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} variant="destructive">
                      {mn.nav.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  {mn.nav.login}
                </Link>
                <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "glow-primary")}>
                  {mn.nav.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
