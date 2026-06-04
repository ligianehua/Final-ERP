"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type FieldLock = {
  user_id: string
  email: string | null
  at: string
}

export type Session = {
  email: string | null
  at: string
}

export type PresenceState = {
  /** Map of session id -> presence entry, including me. */
  sessions: Record<string, Session>
  /** Field-level locks, keyed by field id. */
  editingFields: Record<string, FieldLock>
  /** Whoever isn't me. */
  others: Array<{ user_id: string } & Session>
  myUserId: string | null
}

/**
 * Template presence + heartbeat. Many admins can be in the same
 * template at once; this hook just keeps my session and any field
 * locks I claim fresh and reports who else is around.
 *
 * Pass `heldFields` whenever the set of fields I'm actively editing
 * changes — the next heartbeat refreshes those locks. (Use
 * `useFieldLock` for explicit claim/release of a single field.)
 */
export function useTemplatePresence(
  formCode: string,
  heldFields: string[] = [],
): PresenceState {
  const [state, setState] = useState<
    Omit<PresenceState, "others" | "myUserId">
  >({
    sessions: {},
    editingFields: {},
  })
  const myIdRef = useRef<string | null>(null)
  // Latest fields-to-refresh, read fresh on each tick without
  // re-binding the heartbeat effect.
  const heldRef = useRef<string[]>(heldFields)
  heldRef.current = heldFields

  const url = `/api/forms/templates/${encodeURIComponent(formCode)}/lock`

  const beat = useCallback(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: heldRef.current }),
      })
      if (!res.ok) return
      const json = await res.json()
      myIdRef.current = json.me?.user_id ?? myIdRef.current
      setState({
        sessions: json.sessions ?? {},
        editingFields: json.editing_fields ?? {},
      })
    } catch {
      // Best-effort heartbeat. Loop continues.
    }
  }, [url])

  useEffect(() => {
    beat()
    const id = window.setInterval(beat, 10_000)
    return () => {
      window.clearInterval(id)
      try {
        fetch(url, { method: "DELETE", keepalive: true }).catch(() => {})
      } catch {
        // Server-side staleness will clean up.
      }
    }
  }, [beat, url])

  useEffect(() => {
    function handler() {
      try {
        navigator.sendBeacon?.(
          url + "?release=1",
          new Blob([JSON.stringify({})], { type: "application/json" }),
        )
      } catch {
        /* fall through to staleness */
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [url])

  const myUserId = myIdRef.current
  const others = Object.entries(state.sessions)
    .filter(([uid]) => uid !== myUserId)
    .map(([user_id, s]) => ({ user_id, ...s }))

  return { ...state, others, myUserId }
}
