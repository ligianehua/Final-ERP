"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NavLinks } from "./nav-links"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer the instant the route actually changes (covers both
  // an explicit close and the user pressing Back).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open so the page underneath
  // doesn't slide around.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden -ml-2"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </Button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 animate-in fade-in"
          />
          {/* Drawer panel */}
          <aside className="relative w-64 max-w-[80%] bg-background border-r border-border flex flex-col shadow-lg animate-in slide-in-from-left">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <span className="text-lg font-semibold tracking-tight">Quill</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks />
          </aside>
        </div>
      )}
    </>
  )
}
