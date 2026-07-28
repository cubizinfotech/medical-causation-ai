import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appMetadata } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-semibold tracking-tight text-foreground">
          {appMetadata.name}
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/case">New Case</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/case">Start Demo</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p className="font-medium text-foreground">{appMetadata.name}</p>
        <p>
          Educational legal research assistance for personal injury attorneys.
          Not medical advice or a substitute for expert review.
        </p>
        <p suppressHydrationWarning>
          © {new Date().getFullYear()} Medical Causation AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
