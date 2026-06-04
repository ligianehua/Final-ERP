import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOrg, listMyOrgs } from "@/lib/orgs/current";
import { visibleNavItems } from "@/components/layout/nav-items";
import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "管理员",
  sales: "销售",
  purchasing: "采购",
  warehouse: "仓库",
  viewer: "只读",
};

/**
 * App-shell layout. Wraps every authed page under (app) with the
 * topbar + sidebar. RSC pre-fetches the org context once so child
 * pages don't refetch the same membership info.
 *
 * Degradations:
 *   - logged out         → redirect /login (defense in depth; proxy
 *                          already does this)
 *   - signed in, no org  → no sidebar, no switcher; the dashboard
 *                          page shows the bootstrap card. As soon as
 *                          they create one, this layout re-renders
 *                          with the full shell.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [current, allOrgs] = await Promise.all([
    getCurrentOrg(),
    listMyOrgs(),
  ]);

  if (!current) {
    // Bootstrap mode: a minimal shell so the page can show the
    // "create your first org" flow without sidebar/switcher noise.
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold tracking-tight">
            Quill ERP
          </span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  const orgOptions = allOrgs.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    baseCurrency: m.org.baseCurrency,
  }));
  const nav = visibleNavItems(current.role);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Topbar
        email={user.email ?? ""}
        roleLabel={ROLE_LABEL[current.role] ?? current.role}
        orgs={orgOptions}
        activeOrgId={current.org.id}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar items={nav} />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
