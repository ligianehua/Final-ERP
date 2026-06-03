"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type LockHolder = {
  email: string | null
  since: string
}

export type LockState =
  | { mode: "loading" }
  | { mode: "editor"; holder: LockHolder; tookOver: boolean }
  | { mode: "viewer"; holder: LockHolder }
  | { mode: "error"; error: string }

/**
 * Template-level editing lock. Acquires on mount, heartbeats every
 * 10s, releases on unmount.
 *
 * The viewer path polls at the same interval — when the holder
 * disappears (closed tab, network drop), the viewer transparently
 * upgrades to editor without a page reload.
 */
export function useTemplateLock(formCode: string): LockState & {
  takeover: () => Promise<void>
  release: () => Promise<void>
} {
  const [state, setState] = useState<LockState>({ mode: "loading" })
  // Ref mirror of `mode === "editor"` so the unmount cleanup can read
  // the latest value without re-binding the effect.
  const heldRef = useRef(false)

  const url = `/api/forms/templates/${encodeURIComponent(formCode)}/lock`

  const tryAcquire = useCallback(
    async (takeover: boolean): Promise<LockState> => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ takeover }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          heldRef.current = true
          return {
            mode: "editor",
            holder: json.holder,
            tookOver: !!json.took_over,
          }
        }
        if (res.status === 409) {
          heldRef.current = false
          return { mode: "viewer", holder: json.holder }
        }
        return {
          mode: "error",
          error: json.error ?? `HTTP ${res.status}`,
        }
      } catch (err) {
        return {
          mode: "error",
          error: err instanceof Error ? err.message : "Network error",
        }
      }
    },
    [url],
  )

  useEffect(() => {
    let cancelled = false

    async function tick(takeover = false) {
      const next = await tryAcquire(takeover)
      if (cancelled) return
      setState(next)
    }

    tick(false)
    const id = window.setInterval(() => tick(false), 10_000)

    return () => {
      cancelled = true
      window.clearInterval(id)
      if (heldRef.current) {
        // Best-effort release. fetch with keepalive lets the request
        // outlive the unmount; the browser may also send beacons.
        try {
          fetch(url, { method: "DELETE", keepalive: true }).catch(() => {})
        } catch {
          // Swallow — release will time out server-side via staleness.
        }
        heldRef.current = false
      }
    }
  }, [tryAcquire, url])

  // beforeunload: nudge a release for hard reloads / tab close. The
  // server's 2-minute staleness window catches the rest.
  useEffect(() => {
    function handler() {
      if (!heldRef.current) return
      try {
        const blob = new Blob([JSON.stringify({})], {
          type: "application/json",
        })
        navigator.sendBeacon?.(url + "?release=1", blob)
      } catch {
        // Beacon API can refuse; staleness window catches it.
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [url])

  const takeover = useCallback(async () => {
    const next = await tryAcquire(true)
    setState(next)
  }, [tryAcquire])

  const release = useCallback(async () => {
    try {
      await fetch(url, { method: "DELETE" })
    } catch {
      // ignore
    }
    heldRef.current = false
  }, [url])

  return { ...state, takeover, release }
}
