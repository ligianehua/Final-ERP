import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOrg } from "@/lib/orgs/current";
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

/**
 * Two states:
 *   1. No orgs    → BootstrapPanel + auto-opened dialog. The (app)
 *                   layout strips its shell in this mode.
 *   2. Has orgs   → ActiveOrgPanel + planning card. Topbar / Sidebar
 *                   come from the layout.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = await getCurrentOrg();

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">概览</h1>
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
          />
        ) : (
          <BootstrapPanel />
        )}
      </div>
    </div>
  );
}

function ActiveOrgPanel({
  orgName,
  slug,
  baseCurrency,
}: {
  orgName: string;
  slug: string;
  baseCurrency: string;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{orgName}</CardTitle>
          <CardDescription>
            slug · <span className="font-mono">{slug}</span> · 本位币{" "}
            <span className="font-mono">{baseCurrency}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>下一步</CardTitle>
          <CardDescription>
            Week 2 起会把侧栏里的「商品 / 仓库 / 往来单位」做出来，先把主数据 CRUD 跑通。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Week 2: items / warehouses / parties 主数据 CRUD</li>
            <li>Week 3: 库存核心（stock_movements + 入出库 / 调拨 / 盘点）</li>
            <li>Week 4: 采购流水线 PO → 收货 → AP</li>
            <li>Week 5: 销售流水线 SO → 发货 → AR</li>
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
          ERP 的所有数据都按组织（organization）隔离。先建一个，
          库存、客户、单据才有地方落。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateOrgDialog defaultOpen />
      </CardContent>
    </Card>
  );
}
