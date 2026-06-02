"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Building2,
  FileCheck,
  FileText,
  History,
  LayoutDashboard,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type NavItem = { href: string; label: string; icon: React.ElementType }

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/forms", label: "Forms", icon: FileCheck },
  { href: "/submissions", label: "History", icon: History },
  { href: "/reminders", label: "Reminders", icon: Bell },
]

/**
 * The nav row list shared between the desktop sidebar and the mobile
 * drawer so they stay byte-identical.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 p-3 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
