"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const START_EVENT = "route-progress:start";
/** A navigation that never finishes stops showing after this. */
const MAX_MS = 15_000;

/**
 * Shows the page progress bar for a navigation started in code, e.g. right
 * before `router.push()`. Link clicks show it on their own.
 */
export function startRouteProgress(): void {
  window.dispatchEvent(new Event(START_EVENT));
}

function locationKey(): string {
  return `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
}

/** True when `href` is another page of the site at `current`. */
export function isOtherPage(
  href: string,
  current: { href: string; origin: string; pathname: string; search: string },
): boolean {
  let url: URL;
  try {
    url = new URL(href, current.href);
  } catch {
    return false;
  }
  return (
    url.origin === current.origin &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.pathname !== current.pathname || url.search !== current.search)
  );
}

/** True for a plain click on a link to another page of this site. */
function isPageLinkClick(event: MouseEvent): boolean {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const anchor =
    event.target instanceof Element ? event.target.closest("a") : null;
  if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  return isOtherPage(anchor.href, window.location);
}

/**
 * A thin bar at the top of the window while the next page loads. On a slow
 * server a click on a link otherwise shows nothing until the page arrives.
 * Mounted once in the root layout; it covers every link in the app.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = `${pathname}?${searchParams.toString()}`;
  // The page the navigation started from; the bar shows until it changes.
  const [from, setFrom] = useState<string | null>(null);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    // The page changed: whatever navigation was running has finished.
    setSeen(current);
    setFrom(null);
  }

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      setFrom(locationKey());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFrom(null), MAX_MS);
    };
    // Capture phase: Next.js links cancel the browser's own navigation.
    const onClick = (event: MouseEvent) => {
      if (isPageLinkClick(event)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      window.clearTimeout(timer);
    };
  }, []);

  if (from === null || from !== current) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15"
    >
      <div className="animate-route-progress h-full w-1/4 rounded-full bg-primary" />
    </div>
  );
}
