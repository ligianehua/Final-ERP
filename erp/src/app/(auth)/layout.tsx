// Passthrough — the (auth) route group only exists to scope future
// shared UI (logo block, footer link, locale switcher) without
// forcing a URL prefix like /auth/login. Add shared chrome here when
// the auth screens start to diverge from the marketing layout.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
