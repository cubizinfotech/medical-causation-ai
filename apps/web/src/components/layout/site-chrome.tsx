"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-session";
import { UserMenu } from "./user-menu";

function appHref(path: "/mca" | "/ewi", signedIn: boolean): string {
  if (signedIn) return path;
  return `/login?next=${encodeURIComponent(path)}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isEwi = pathname?.startsWith("/ewi");
  const isMca = pathname?.startsWith("/mca");
  const signedIn = Boolean(user);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link
          href="/"
          className="max-w-[11rem] truncate text-lg font-semibold tracking-tight text-foreground sm:max-w-none"
        >
          {isEwi
            ? "Expert Witness Investigation"
            : isMca
              ? "Medical Causation AI"
              : "Legal Research AI"}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <Button
              asChild
              size="sm"
              variant={isMca ? "default" : "ghost"}
            >
              <Link href={appHref("/mca", signedIn)}>MCA</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={isEwi ? "default" : "ghost"}
            >
              <Link href={appHref("/ewi", signedIn)}>EWI</Link>
            </Button>
          </div>
          {signedIn && isEwi ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/ewi/histories">Histories</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/ewi/intake">New investigation</Link>
              </Button>
            </>
          ) : null}
          {signedIn && isMca ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/mca/histories">Histories</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/mca/case">New analysis</Link>
              </Button>
            </>
          ) : null}
          {user ? (
            <div className="ml-2 flex items-center border-l border-border pl-4">
              <UserMenu user={user} />
            </div>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { user } = useAuth();
  const signedIn = Boolean(user);

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
            <Link
              href={appHref("/mca", signedIn)}
              className="text-muted-foreground hover:text-foreground"
            >
              MCA
            </Link>
            <Link
              href={appHref("/ewi", signedIn)}
              className="text-muted-foreground hover:text-foreground"
            >
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
