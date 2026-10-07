"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { useDismissOnOutsidePointer } from "@/components/ui/popover";
import {
  roleLabel,
  useAuth,
  type AuthSessionUser,
} from "@/features/auth/auth-session";
import { UserAvatar } from "@/components/profile/user-avatar";
import { cn } from "@/utils/cn";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/** Avatar button in the site header with Profile and Sign out. */
export function UserMenu({ user }: { user: AuthSessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, signingOut } = useAuth();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const menuId = React.useId();
  const avatarProps = {
    displayName: user.displayName,
    email: user.email,
    avatarUpdatedAt: user.avatarUpdatedAt,
  };
  const showName = user.displayName && user.displayName !== user.email;
  const role = user.roles[0];

  const close = React.useCallback(() => setOpen(false), []);
  useDismissOnOutsidePointer(containerRef, open, close);

  const focusItem = (index: number) => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]',
    );
    if (!items?.length) return;
    items[(index + items.length) % items.length].focus();
  };

  // Focus the first item when the menu opens.
  React.useEffect(() => {
    if (open) focusItem(0);
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        [],
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(current + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusItem(current - 1);
        return;
      case "Home":
        event.preventDefault();
        focusItem(0);
        return;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        return;
      case "Escape":
        event.preventDefault();
        closeAndFocusTrigger();
        return;
      case "Tab":
        setOpen(false);
        return;
    }
  };

  const signOut = () => {
    setOpen(false);
    logout();
    router.push("/login");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.email}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "rounded-full shadow-sm ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "ring-2 ring-primary/40",
        )}
      >
        <UserAvatar {...avatarProps} className="h-9 w-9 text-xs" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <UserAvatar {...avatarProps} className="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {showName ? user.displayName : user.email}
              </p>
              {showName ? (
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              ) : null}
              {role ? (
                <p className="truncate text-xs text-muted-foreground">
                  {roleLabel(role)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="my-1 h-px bg-border" role="separator" />
          <Link
            href="/profile"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className={cn(itemClass, pathname === "/profile" && "bg-muted/60")}
          >
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={signingOut}
            onClick={signOut}
            className={cn(itemClass, "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10")}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
