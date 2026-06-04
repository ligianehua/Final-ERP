"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateOrgDialog } from "@/components/orgs/create-org-dialog";

export interface OrgOption {
  id: string;
  name: string;
  baseCurrency: string;
}

interface Props {
  /** All orgs the current user belongs to. */
  orgs: OrgOption[];
  /** Active org id resolved by getCurrentOrg() server-side. */
  activeOrgId: string;
}

/**
 * Topbar dropdown. Shows the active org name; clicking opens a list
 * of all memberships + a "create new org" affordance.
 *
 * Switching POSTs to /api/orgs/active (which re-checks membership)
 * and router.refresh()es so every RSC re-renders against the new
 * active org.
 */
export function OrgSwitcher({ orgs, activeOrgId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  async function switchOrg(orgId: string) {
    if (orgId === activeOrgId) return;
    setPendingId(orgId);
    const res = await fetch("/api/orgs/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) {
      setPendingId(null);
      // Silent noop on failure (e.g. membership revoked between page
      // load and click). Replace with a toast once we wire one up.
      return;
    }
    startTransition(() => {
      router.refresh();
      setOpen(false);
      setPendingId(null);
    });
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 max-w-[220px] justify-between"
          >
            <span className="truncate">{active?.name ?? "选择组织"}</span>
            <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            你的组织
          </DropdownMenuLabel>
          {orgs.map((org) => {
            const isActive = org.id === activeOrgId;
            const isPending = pendingId === org.id && pending;
            return (
              <DropdownMenuItem
                key={org.id}
                onSelect={(e) => {
                  e.preventDefault();
                  void switchOrg(org.id);
                }}
                className="cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{org.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {org.baseCurrency}
                  </div>
                </div>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check
                    className={cn(
                      "size-4",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              // Defer to next tick so the dropdown closes cleanly
              // before the dialog grabs focus.
              setTimeout(() => setCreateOpen(true), 0);
            }}
            className="cursor-pointer"
          >
            <Plus className="size-4 mr-2" />
            <span>新建组织</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
