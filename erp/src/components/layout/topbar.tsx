import Link from "next/link";
import { OrgSwitcher, type OrgOption } from "./org-switcher";
import { UserMenu } from "./user-menu";

interface Props {
  email: string;
  roleLabel: string;
  orgs: OrgOption[];
  activeOrgId: string;
}

/**
 * Server topbar — collects everything an app shell needs:
 *   [logo]  [org switcher]                     [user menu]
 *
 * Splits into client islands for the two dropdowns so most of the
 * topbar streams as static markup.
 */
export function Topbar({ email, roleLabel, orgs, activeOrgId }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight shrink-0"
        >
          Quill ERP
        </Link>
        <span className="text-muted-foreground" aria-hidden>
          /
        </span>
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
      </div>

      <UserMenu email={email} roleLabel={roleLabel} />
    </header>
  );
}
