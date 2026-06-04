import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";

/**
 * OAuth / magic-link code-exchange landing. Not used by the OTP flow
 * (which calls verifyOtp directly on the client), but wired up now so
 * future providers — Google, GitHub, magic links — work out of the box.
 *
 * Convention: `?next=/somewhere` controls the post-login destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
