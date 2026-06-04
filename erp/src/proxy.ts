import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed middleware → proxy. Same execution model: runs
 * before every matched request, can rewrite/redirect/modify headers.
 *
 * Two jobs here:
 *   1. Refresh the Supabase session cookie on every request so the
 *      access token stays fresh in Server Components.
 *   2. Coarse auth gate — keep logged-out users out of the app and
 *      bounce logged-in users away from /login & /signup.
 *
 * Fine-grained RBAC (sales vs warehouse vs admin) lives in API routes
 * and Server Actions, not here — proxy is for cheap, optimistic checks
 * per Next.js docs.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // App routes that require a session. Add new top-level segments here
  // as they ship (items, warehouses, parties, sales, purchases, …).
  const protectedPrefixes = [
    "/dashboard",
    "/items",
    "/warehouses",
    "/parties",
    "/sales",
    "/purchases",
    "/reports",
    "/settings",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the auth screens.
  if ((pathname === "/login" || pathname === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run on everything except static assets and Next.js internals.
  // API routes are deliberately included — refreshing the cookie there
  // keeps long-lived tabs from 401-ing after the access token expires.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
