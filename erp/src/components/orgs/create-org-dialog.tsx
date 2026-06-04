"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  /** When true the dialog renders pre-opened — used by the bootstrap UI. */
  defaultOpen?: boolean;
  /** Optional custom trigger; falls back to a primary button. */
  trigger?: React.ReactNode;
};

const CURRENCIES = ["CNY", "USD", "PHP"] as const;

/**
 * Create-organization form. Used in two places:
 *   1. Bootstrap card on first login (defaultOpen, no trigger)
 *   2. Topbar / org switcher "+ new org" (Week 1 Day 5)
 *
 * On success the cookie is set server-side and we router.refresh() so
 * the active-org-dependent panels re-render.
 */
export function CreateOrgDialog({ defaultOpen = false, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] =
    useState<(typeof CURRENCIES)[number]>("CNY");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, baseCurrency }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      setError(data.hint ?? data.error ?? "创建失败");
      return;
    }

    startTransition(() => {
      // RSC re-fetches: /dashboard will now see the new org via cookie.
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !defaultOpen ? (
        <DialogTrigger asChild>
          <Button>新建组织</Button>
        </DialogTrigger>
      ) : null}

      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>创建组织</DialogTitle>
            <DialogDescription>
              组织是 ERP 的多租户边界。库存、客户、单据都按组织隔离。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">组织名称</Label>
              <Input
                id="org-name"
                placeholder="比如：上海菱锦贸易"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-currency">本位币</Label>
              <select
                id="org-currency"
                value={baseCurrency}
                onChange={(e) =>
                  setBaseCurrency(e.target.value as (typeof CURRENCIES)[number])
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                所有跨币种单据按本位币换算到报表。创建后暂不可改。
              </p>
            </div>
          </div>

          <DialogFooter>
            {!defaultOpen && (
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  取消
                </Button>
              </DialogClose>
            )}
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              创建组织
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
