import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, FileText, Clock, Shield } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight">Quill</span>
            <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">翎</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1 mb-8">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            Built for Philippine SMEs
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-tight mb-6">
            Snap a form.
            <br />
            Get a filled PDF.
            <br />
            <span className="text-muted-foreground">In 60 seconds.</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Quill is your AI permit advisor. Upload a government form photo,
            and we&apos;ll fill it with your company data — BIR, SEC, SSS, Mayor&apos;s Permit — automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col gap-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <FileText className="size-5 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">AI Form Filling</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Photo → OCR → Claude maps fields from your Company Archive. BIR 2550M, Mayor&apos;s Permit, and more.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <Clock className="size-5 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Expiry Reminders</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Never miss a permit renewal. Get email alerts 90, 30, 14, and 7 days before any document expires.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <Shield className="size-5 text-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Company Archive</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Store TINs, SEC numbers, employee records, and certificates securely — reused across every filing.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Quill · 翎. Built for Philippine SMEs.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Paperwork, signed off. / 翰墨自此，非负担。
          </p>
        </div>
      </footer>
    </div>
  )
}
