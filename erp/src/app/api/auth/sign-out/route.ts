import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";

/**
 * POST /api/auth/sign-out — clears the Supabase session cookie and
 * sends the user back to the landing page.
 *
 * POST (not GET) so a CSRF-induced page load can't sign anyone out.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
