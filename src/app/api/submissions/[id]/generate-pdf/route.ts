import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"
import { getEffectiveFormSchema } from "@/lib/forms/registry-effective"
import { generateFormPDF } from "@/lib/forms/generate-pdf"

type Params = { params: Promise<{ id: string }> }

// POST /api/submissions/[id]/generate-pdf
// Renders the submission into a PDF, uploads to Storage under the user's
// folder, updates the submission with output_pdf_path + status=completed.
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: sub, error: subError } = await supabase
    .from("form_submissions")
    .select("*, companies(name)")
    .eq("id", id)
    .single()

  if (subError || !sub) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 })
  }

  const schema = await getEffectiveFormSchema(sub.form_code)
  if (!schema) {
    return NextResponse.json(
      { error: `No PDF template for ${sub.form_code}` },
      { status: 400 }
    )
  }

  const companyName =
    (sub.companies as { name: string } | null)?.name ?? "Unknown"

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateFormPDF({
      schema,
      values: (sub.field_values ?? {}) as Record<string, string | null>,
      companyName,
      period: sub.period,
      overrides: (sub.field_overrides ?? {}) as Record<
        string,
        { dx: number; dy: number }
      >,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Upload to Storage under {user_id}/_generated/{submission_id}.pdf
  const objectKey = `${user.id}/_generated/${sub.id}.pdf`
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(objectKey, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from("form_submissions")
    .update({
      output_pdf_path: objectKey,
      status: "completed",
    })
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ submission: updated, file_path: objectKey })
}
