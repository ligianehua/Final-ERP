"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Holder = { email: string | null; since: string }

export type FieldLockState =
  | { mode: "idle" }
  | { mode: "holder"; took_over: boolean }
  | { mode: "busy"; holder: Holder }
  | { mode: "error"; error: string }

/**
 * Claim a per-field lock for the lifetime of `active=true`. The
 * template-level presence hook heartbeats this lock alongside its own
 * session, so we don't need a separate timer here.
 *
 * Typical use: pass `active=true` when an inline editor opens for a
 * given field and the user starts typing, `false` when it closes.
 */
export function useFieldLock(
  formCode: string,
  fieldId: string | null,
  active: boolean,
): FieldLockState & { takeover: () => Promise<void> } {
  const [state, setState] = useState<FieldLockState>({ mode: "idle" })
  const fieldRef = useRef<string | null>(null)

  const post = useCallback(
    async (fid: string, takeover: boolean): Promise<FieldLockState> => {
      try {
        const res = await fetch(
          `/api/forms/templates/${encodeURIComponent(formCode)}/fields/${encodeURIComponent(fid)}/lock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ takeover }),
          },
        )
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          return { mode: "holder", took_over: !!json.took_over }
        }
        if (res.status === 409) {
          return { mode: "busy", holder: json.holder }
        }
        return { mode: "error", error: json.error ?? `HTTP ${res.status}` }
      } catch (e) {
        return {
          mode: "error",
          error: e instanceof Error ? e.message : "Network error",
        }
      }
    },
    [formCode],
  )

  useEffect(() => {
    if (!active || !fieldId) {
      // Release any field we were holding.
      const prev = fieldRef.current
      if (prev) {
        fetch(
          `/api/forms/templates/${encodeURIComponent(formCode)}/fields/${encodeURIComponent(prev)}/lock`,
          { method: "DELETE", keepalive: true },
        ).catch(() => {})
        fieldRef.current = null
      }
      setState({ mode: "idle" })
      return
    }
    fieldRef.current = fieldId
    let cancelled = false
    post(fieldId, false).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
      // Release on field change / unmount.
      fetch(
        `/api/forms/templates/${encodeURIComponent(formCode)}/fields/${encodeURIComponent(fieldId)}/lock`,
        { method: "DELETE", keepalive: true },
      ).catch(() => {})
    }
  }, [formCode, fieldId, active, post])

  const takeover = useCallback(async () => {
    if (!fieldId) return
    setState(await post(fieldId, true))
  }, [fieldId, post])

  return { ...state, takeover }
}
