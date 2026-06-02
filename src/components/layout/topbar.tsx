import Link from "next/link"
import { signOut } from "@/app/(dashboard)/actions"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { MobileNav } from "./mobile-nav"

export function Topbar({
  email,
  isAdmin = false,
}: {
  email?: string
  isAdmin?: boolean
}) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-1">
        <MobileNav isAdmin={isAdmin} />
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">Quill</span>
          <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">翎</span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {email && <span className="text-sm text-muted-foreground hidden sm:inline">{email}</span>}
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm" className="gap-2">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
