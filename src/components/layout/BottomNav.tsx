"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, LayoutDashboard, Monitor, Target, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { mn } from "@/locales/mn"

const items = [
  { href: "/dashboard", label: mn.nav.home, icon: LayoutDashboard },
  { href: "/tournaments", label: mn.nav.tournaments, icon: Trophy },
  { href: "/local", label: "Local", icon: Target },
  { href: "/play", label: mn.nav.play, icon: Monitor },
  { href: "/ratings", label: mn.nav.ratings, icon: BarChart3 },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md">
      <div className="grid grid-cols-5 h-16">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-all",
                  isActive ? "text-primary scale-110" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
