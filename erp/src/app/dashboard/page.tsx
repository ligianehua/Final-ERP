import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/auth/supabase-server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Day-3 placeholder. Once the org-bootstrap flow lands (Week 1 Day 4),
 * this page splits into:
 *   - org switcher
 *   - "Upcoming" widget (overdue invoices, low-stock items, …)
 *   - "Recent activity" widget (last N stock movements, orders, …)
 *
 * For now: prove the auth round-trip works and let the user sign out.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: proxy.ts already redirects here, but the cookie
  // could expire between proxy and render — better to handle both.
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-6 py-12 bg-background">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            欢迎回来 · 你已登录为{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>下一步</CardTitle>
            <CardDescription>
              Week 1 Day 4 起，这里会变成多组织切换器 + 概览面板。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Day 4: 组织（organization）创建 + 切换</li>
              <li>Day 5: RBAC middleware + 仪表盘骨架（topbar / sidebar）</li>
              <li>Week 2: items / warehouses / parties 主数据 CRUD</li>
            </ul>
          </CardContent>
        </Card>

        <form action="/api/auth/sign-out" method="post">
          <Button type="submit" variant="outline" size="sm">
            退出登录
          </Button>
        </form>
      </div>
    </main>
  );
}
