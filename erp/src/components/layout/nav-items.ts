import {
  LayoutDashboard,
  Boxes,
  Warehouse,
  Users,
  ShoppingCart,
  PackageSearch,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/lib/db/schema";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that may see this entry. Undefined = anyone in the org. */
  roles?: OrgRole[];
}

/**
 * Single source of truth for app-shell navigation. Topbar (mobile) and
 * Sidebar (desktop) both consume this — adding a new module is one
 * line here plus the page itself.
 *
 * Most modules ship in Week 2+; links go nowhere meaningful yet but
 * that's fine — Next.js renders a 404 and the placeholder shape lets
 * us design the IA in advance.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard },
  { href: "/items", label: "商品", icon: Boxes },
  { href: "/warehouses", label: "仓库", icon: Warehouse },
  { href: "/parties", label: "往来单位", icon: Users },
  { href: "/sales", label: "销售", icon: ShoppingCart, roles: ["org_admin", "sales", "viewer"] },
  { href: "/purchases", label: "采购", icon: PackageSearch, roles: ["org_admin", "purchasing", "viewer"] },
  { href: "/reports", label: "报表", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings, roles: ["org_admin"] },
];

/** Filter nav items for the current user's role. */
export function visibleNavItems(role: OrgRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
