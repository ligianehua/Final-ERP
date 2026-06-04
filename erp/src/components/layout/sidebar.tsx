"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

/**
 * Desktop sidebar. Renders inside the (app) layout to the left of
 * the page content. Mobile uses a Sheet drawer toggled from the
 * topbar (Day 8 polish — not built yet).
 *
 * `items` is filtered server-side by the user's role before being
 * passed in, so nothing here cares about RBAC.
 */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="hidden md:flex shrink-0 flex-col gap-1 w-56 border-r p-3"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
