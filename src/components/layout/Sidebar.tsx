"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  Home,
  LayoutDashboard,
  Monitor,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { mn } from "@/locales/mn"
import { Profile } from "@/types/database"
import { Badge } from "@/components/ui/badge"

interface SidebarProps {
  profile: Profile | null
}

const navItems = [
  { href: "/dashboard", label: mn.nav.home, icon: LayoutDashboard },
  { href: "/tournaments", label: "Тэмцээн", icon: Trophy },
  { href: "/play", label: mn.nav.play, icon: Monitor, badge: "LIVE" },
  { href: "/ratings", label: mn.nav.ratings, icon: BarChart3 },
  { href: "/calendar", label: "Календарь", icon: Calendar },
  { href: "/clubs", label: mn.nav.clubs, icon: Building2 },
  { href: "/stats", label: mn.nav.stats, icon: BarChart3 },
  { href: "/pricing", label: "Subscription", icon: CreditCard },
]

const adminItems = [
  { href: "/admin", label: mn.admin.title, icon: Shield },
  { href: "/admin/users", label: mn.admin.users, icon: Users },
  { href: "/admin/tournaments", label: mn.admin.tournaments, icon: Trophy },
  { href: "/admin/clubs", label: mn.admin.clubs, icon: Building2 },
  { href: "/admin/payments", label: mn.admin.payments, icon: CreditCard },
  { href: "/admin/cosmetics", label: "Cosmetics", icon: Sparkles },
  { href: "/admin/caller", label: "Дуут зарлагч", icon: Volume2 },
]

interface NavItemProps {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  isActive: boolean
}

function NavItem({ href, label, icon: Icon, badge, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        "hover:bg-secondary hover:text-foreground group",
        isActive
          ? "bg-primary/15 text-primary border border-primary/20"
          : "text-muted-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <Badge className="h-4 px-1 text-[9px] bg-live text-white pulse-live border-0">
          {badge}
        </Badge>
      )}
      {isActive && <ChevronRight className="h-3 w-3 text-primary" />}
    </Link>
  )
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/50 bg-sidebar">
      <nav className="flex-1 space-y-0.5 p-3 pt-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Үндсэн цэс
        </p>
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}

        {profile && (
          <NavItem
            href={`/profile/${profile.username}`}
            label={mn.nav.profile}
            icon={Target}
            isActive={pathname.startsWith("/profile/" + profile.username)}
          />
        )}

        {profile?.role === "admin" && (
          <>
            <div className="pt-4">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Админ
              </p>
              {adminItems.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-border/50 p-3">
        <Link
          href="/settings/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          <span>{mn.nav.settings}</span>
        </Link>
      </div>
    </aside>
  )
}
