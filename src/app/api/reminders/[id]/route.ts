import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/db/server"

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  snoozed_until: z.string().date().nullable().optional(),
  dismissed_at: z.string().datetime().nullable().optional(),
})

// PATCH /api/reminders/[id] — snooze or dismiss a reminder.
//
// Snooze: { snoozed_until: "2026-06-15" }  — hides until that date
// Un-snooze: { snoozed_until: null }
// Dismiss: { dismissed_at: <ISO timestamp> } — hides permanently
// Un-dismiss: { dismissed_at: null }
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { data, error } = await supabase
    .from("reminders")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ reminder: data })
}

// DELETE /api/reminders/[id] — actually remove. The compute job WILL
// re-create the same row tomorrow, so users should Dismiss instead.
// We expose DELETE anyway for the "just clean this up please" use case.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase.from("reminders").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
