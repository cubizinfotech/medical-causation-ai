import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appMetadata } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {appMetadata.name}
        </Link>
        <Button asChild size="sm">
          <Link href="/case">Start Demo</Link>
        </Button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">{appMetadata.name}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Enterprise AI platform for medical causation research. For
              informational and legal research purposes only.
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms of Use
            </Link>
          </nav>
        </div>
        <p
          className="text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          © {new Date().getFullYear()} Medical Causation AI. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
