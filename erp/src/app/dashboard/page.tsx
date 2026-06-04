import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOrg } from "@/lib/orgs/current";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";

export const metadata: Metadata = {
  title: "Dashboard",
};

const ROLE_LABEL: Record<string, string> = {
  org_admin: "管理员",
  sales: "销售",
  purchasing: "采购",
  warehouse: "仓库",
  viewer: "只读",
};

/**
 * Two states branched off membership:
 *
 *   1. No orgs yet  → bootstrap card with an inline open dialog,
 *                     guiding the user to create their first org.
 *   2. Has at least → active-org card + the planning placeholder
 *      one org        (replaced by real widgets in Week 1 Day 5+).
 *
 * Proxy.ts already redirects logged-out users — the redirect here is
 * belt-and-suspenders for the case where the cookie expires between
 * proxy and render.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = await getCurrentOrg();

  return (
    <main className="min-h-screen px-6 py-12 bg-background">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            欢迎回来 ·{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </header>

        {current ? (
          <ActiveOrgPanel
            orgName={current.org.name}
            slug={current.org.slug}
            baseCurrency={current.org.baseCurrency}
            roleLabel={ROLE_LABEL[current.role] ?? current.role}
          />
        ) : (
          <BootstrapPanel />
        )}

        <form action="/api/auth/sign-out" method="post">
          <Button type="submit" variant="outline" size="sm">
            退出登录
          </Button>
        </form>
      </div>
    </main>
  );
}

function ActiveOrgPanel({
  orgName,
  slug,
  baseCurrency,
  roleLabel,
}: {
  orgName: string;
  slug: string;
  baseCurrency: string;
  roleLabel: string;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{orgName}</CardTitle>
              <CardDescription>
                slug · <span className="font-mono">{slug}</span> ·
                本位币 <span className="font-mono">{baseCurrency}</span>
              </CardDescription>
            </div>
            <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-muted-foreground">
              你是 · {roleLabel}
            </span>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>下一步</CardTitle>
          <CardDescription>
            Week 1 Day 5 起，这里会变成多组织切换器 + 概览面板。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Day 5: dashboard 骨架（topbar / sidebar）+ 组织切换器</li>
            <li>Week 2: items / warehouses / parties 主数据 CRUD</li>
            <li>Week 3: 库存核心（stock_movements + 入出库 / 调拨 / 盘点）</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function BootstrapPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>创建你的第一个组织</CardTitle>
        <CardDescription>
          ERP 的所有数据都按组织（organization）隔离。先建一个，库存、客户、
          单据才有地方落。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateOrgDialog defaultOpen />
      </CardContent>
    </Card>
  );
}
