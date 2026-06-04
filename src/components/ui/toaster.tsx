"use client"

import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Variant = "default" | "success" | "destructive"

type Toast = {
  id: string
  title?: string
  description?: string
  variant?: Variant
  duration?: number
}

/**
 * Module-scoped emitter so any client component can call `toast(...)`
 * without needing to be wrapped in a context. The Toaster element below
 * subscribes on mount and clears the reference on unmount.
 */
let emit: ((t: Omit<Toast, "id">) => void) | null = null

export function toast(t: Omit<Toast, "id">) {
  emit?.(t)
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  React.useEffect(() => {
    emit = (t) => {
      const id = (globalThis.crypto?.randomUUID?.() ?? String(Math.random())) as string
      setToasts((prev) => [...prev, { ...t, id }])
      const duration = t.duration ?? 4500
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id))
      }, duration)
    }
    return () => {
      emit = null
    }
  }, [])

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          duration={t.duration ?? 4500}
          onOpenChange={(open) => {
            if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id))
          }}
          className={cn(
            "group pointer-events-auto relative w-full max-w-sm rounded-md border bg-background p-4 pr-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
            "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
            "data-[swipe=end]:animate-out data-[state=open]:slide-in-from-right-full",
            "data-[state=closed]:fade-out-80",
            t.variant === "destructive" &&
              "border-destructive/30 bg-destructive/5",
            t.variant === "success" &&
              "border-green-600/30 bg-green-600/5",
          )}
        >
          <div className="flex items-start gap-3">
            <VariantIcon variant={t.variant ?? "default"} />
            <div className="flex-1 min-w-0">
              {t.title && (
                <ToastPrimitive.Title className="text-sm font-medium">
                  {t.title}
                </ToastPrimitive.Title>
              )}
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
          </div>
          <ToastPrimitive.Close
            aria-label="Close"
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport
        className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm"
      />
    </ToastPrimitive.Provider>
  )
}

function VariantIcon({ variant }: { variant: Variant }) {
  if (variant === "success")
    return <CheckCircle2 className="size-4 text-green-700 shrink-0 mt-0.5" />
  if (variant === "destructive")
    return <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
  return <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
}
