"use client";

import * as React from "react";

export type PopoverSide = "top" | "bottom";

/** Closes a popover when the user presses anywhere outside `ref`. */
export function useDismissOnOutsidePointer(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  const onDismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onDismissRef.current();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, ref]);
}

/**
 * Opens upward when there is not enough room below the anchor.
 * `bottomInset` leaves space for sticky footers such as the MCA action bar.
 */
export function popoverSide(
  anchor: HTMLElement,
  panelHeight: number,
  bottomInset = 96,
): PopoverSide {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - bottomInset;
  const spaceAbove = rect.top;
  return spaceBelow < panelHeight && spaceAbove > spaceBelow ? "top" : "bottom";
}
