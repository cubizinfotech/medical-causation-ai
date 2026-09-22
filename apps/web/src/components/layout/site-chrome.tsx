"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const pathname = usePathname();
  const isEwi = pathname?.startsWith("/ewi");
  const isMca = pathname?.startsWith("/mca");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {isEwi
            ? "Expert Witness Investigation"
            : isMca
              ? "Medical Causation AI"
              : "Legal Research AI"}
        </Link>
        <nav className="flex items-center gap-3">
          {isEwi ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/ewi/histories">Histories</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/ewi/intake">New Investigation</Link>
              </Button>
            </>
          ) : isMca ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/mca/histories">Histories</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/mca/case">Start Demo</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/mca">MCA</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/ewi">EWI</Link>
              </Button>
            </>
          )}
        </nav>
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
            <p className="font-semibold text-foreground">Legal Research AI</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              MCA and EWI for attorney research. Informational and legal research
              purposes only.
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link href="/mca" className="text-muted-foreground hover:text-foreground">
              MCA
            </Link>
            <Link href="/ewi" className="text-muted-foreground hover:text-foreground">
              EWI
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms of Use
            </Link>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          © {new Date().getFullYear()} Legal Research AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
