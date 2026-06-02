"use client"

import Link from "next/link"
import { Bell, Search, Target, Trophy } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface NavbarProps {
  profile: Profile | null
}

export function Navbar({ profile }: NavbarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success(mn.auth.logoutSuccess)
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-md">
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

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden md:flex text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" />
          </Button>

          {profile ? (
            <>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  3
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className="relative h-8 w-8 rounded-full p-0 inline-flex items-center justify-center">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {profile.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">{profile.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Trophy className="h-3 w-3 text-[oklch(0.78_0.16_85)]" />
                        <span className="text-xs font-medium text-[oklch(0.78_0.16_85)]">{profile.rating_points} pts</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/profile/${profile.username}`)}>
                    {mn.nav.profile}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    {mn.nav.settings}
                  </DropdownMenuItem>
                  {profile.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push("/admin")}>
                        {mn.nav.admin}
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
  )
}
