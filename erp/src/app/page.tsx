import Link from "next/link";
import { Boxes, ShoppingCart, Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Boxes,
    title: "库存仓储",
    body: "多仓库、多计量单位、批次/序列号可选。所有数量变动走 append-only 凭证账，余额对得起每一分。",
  },
  {
    icon: ShoppingCart,
    title: "销售采购",
    body: "从询价到对账完整流水线：销售单、采购单、发货收货、AR/AP 台账，PDF 一键外发。",
  },
  {
    icon: Coins,
    title: "多币种核算",
    body: "CNY / USD / PHP 三币种内建，汇率每日自动刷新；单据锁汇率，报表按本位币换算。",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Quill ERP
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">免费试用</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground mb-4">
            为跨区域中小企业打造
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-foreground">
            一套现代 ERP，<br />
            让库存、销售、采购对得起每一分钱。
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Quill ERP 用一条 append-only 库存凭证账、多币种汇率引擎、和角色化协作流，
            让团队从今天开始就能跑通完整业务。
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                免费开始
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">登录已有账号</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col">
                <div className="inline-flex w-10 h-10 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Quill ERP</span>
          <span className="font-mono text-xs">v0.1.0 · Week 1 · Day 1</span>
        </div>
      </footer>
    </main>
  );
}
