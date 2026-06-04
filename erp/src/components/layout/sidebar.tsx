"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "./nav-items";
import type { OrgRole } from "@/lib/db/schema";

/**
 * Desktop sidebar. Renders inside the (app) layout to the left of
 * the page content. Mobile uses a Sheet drawer toggled from the
 * topbar (Day 8 polish — not built yet).
 *
 * We can't accept the NavItem[] array as a prop because each item
 * carries a Lucide icon *component* (a function with $$typeof) and
 * Next.js refuses to serialize that across the server → client
 * boundary. Instead we take the user's role (a plain string) and
 * filter the static nav-items list right here on the client.
 */
export function Sidebar({ role }: { role: OrgRole }) {
  const pathname = usePathname();
  const items = visibleNavItems(role);

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
