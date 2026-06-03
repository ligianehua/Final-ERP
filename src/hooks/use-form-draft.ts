"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Slot = {
  formCode: string
  companyId: string | null
  signatoryId: string | null
}

export type CloudDraft = {
  values: Record<string, string>
  overrides: Record<string, unknown>
  period: string | null
  updated_at: string
}

/** Build URL with the company / signatory query params the API
 * expects on every method. */
function url(slot: Slot, action?: "release"): string {
  const params = new URLSearchParams()
  if (slot.companyId) params.set("company_id", slot.companyId)
  if (slot.signatoryId) params.set("signatory_id", slot.signatoryId)
  if (action) params.set("action", action)
  const qs = params.toString()
  return `/api/forms/drafts/${encodeURIComponent(slot.formCode)}${
    qs ? "?" + qs : ""
  }`
}

/**
 * Cross-device autosave for the fill flow. localStorage is still the
 * primary draft (offline-friendly, instant); this layer adds a
 * server-side copy that lets a user resume from another device.
 *
 * - `loadInitial()` returns the cloud draft if the server copy is
 *   newer than `localUpdatedAt` (so a user who edited offline on
 *   device A doesn't get overwritten by a stale device-B cloud
 *   draft).
 * - `save()` debounces and PUTs the latest snapshot every 2s.
 * - `clear()` deletes the row; call after a successful submission.
 */
export function useFormDraft(slot: Slot) {
  const slotRef = useRef(slot)
  slotRef.current = slot

  const loadCloud = useCallback(async (): Promise<CloudDraft | null> => {
    try {
      const res = await fetch(url(slotRef.current), { cache: "no-store" })
      if (!res.ok) return null
      const json = await res.json()
      return (json.draft as CloudDraft | null) ?? null
    } catch {
      return null
    }
  }, [])

  const clear = useCallback(async () => {
    try {
      await fetch(url(slotRef.current), { method: "DELETE" })
    } catch {
      /* swallow */
    }
  }, [])

  return {
    loadCloud,
    clear,
    save: makeDebouncedSave(slotRef),
  }
}

function makeDebouncedSave(slotRef: { current: Slot }) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastQueued = 0
  return function save(snapshot: {
    values: Record<string, string>
    overrides: Record<string, unknown>
    period: string | null
  }) {
    if (timer) clearTimeout(timer)
    lastQueued = Date.now()
    const queuedAt = lastQueued
    timer = setTimeout(async () => {
      if (queuedAt !== lastQueued) return
      const slot = slotRef.current
      try {
        await fetch(url(slot), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: slot.companyId,
            signatory_id: slot.signatoryId,
            ...snapshot,
          }),
        })
      } catch {
        // Network blip — localStorage still has the latest copy.
      }
    }, 2000)
  }
}

/** React-friendly wrapper: cloud-restore prompt + autosave effect. */
export function useFormDraftSync(args: {
  formCode: string
  companyId: string | null
  signatoryId: string | null
  values: Record<string, string>
  overrides: Record<string, unknown>
  period: string | null
  /** Don't autosave until the restore prompt has been resolved. */
  enabled: boolean
  /** Most recent localStorage save timestamp (ISO). Used to decide if
   * the cloud copy is fresher. */
  localUpdatedAt: string | null
}): {
  cloudDraft: CloudDraft | null
  loaded: boolean
  clearCloud: () => Promise<void>
} {
  const { formCode, companyId, signatoryId, values, overrides, period, enabled } =
    args
  const slot = { formCode, companyId, signatoryId }
  const { loadCloud, clear, save } = useFormDraft(slot)
  const [cloudDraft, setCloudDraft] = useState<CloudDraft | null>(null)
  const [loaded, setLoaded] = useState(false)

  // One-shot cloud fetch on mount / slot change.
  useEffect(() => {
    let cancelled = false
    loadCloud().then((d) => {
      if (cancelled) return
      // Only surface the cloud copy if it's newer than what
      // localStorage already has. Stale cloud copies stay invisible.
      const localTs = args.localUpdatedAt
        ? Date.parse(args.localUpdatedAt)
        : 0
      const cloudTs = d?.updated_at ? Date.parse(d.updated_at) : 0
      setCloudDraft(d && cloudTs > localTs ? d : null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // We intentionally only re-run when the slot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formCode, companyId, signatoryId])

  // Debounced autosave once enabled. localStorage already handles the
  // 600ms cadence inside fill-flow; we go a bit slower (2s) to be
  // gentle on the server.
  useEffect(() => {
    if (!enabled) return
    save({ values, overrides, period })
  }, [enabled, values, overrides, period, save])

  return { cloudDraft, loaded, clearCloud: clear }
}
