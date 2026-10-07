"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { useDismissOnOutsidePointer } from "./popover";

export interface ComboboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "list" | "role"
  > {
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions only. Free text is still accepted. */
  options: readonly string[];
  emptyMessage?: string;
}

/**
 * Text input with a styled suggestion list. Replaces <datalist>, whose popup
 * is drawn by the browser and cannot be themed.
 */
export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      value,
      onValueChange,
      options,
      emptyMessage = "No match. Your text will be used as typed.",
      className,
      id,
      disabled,
      onBlur,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const listboxId = `${inputId}-listbox`;
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const [open, setOpen] = React.useState(false);
    // Filter only after the user types; opening the list shows everything.
    const [filtering, setFiltering] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const filtered = React.useMemo(() => {
      const query = value.trim().toLowerCase();
      if (!filtering || !query) return options;
      return options.filter((option) => option.toLowerCase().includes(query));
    }, [filtering, options, value]);

    const openList = React.useCallback(() => {
      setFiltering(false);
      setActiveIndex(
        options.findIndex(
          (option) => option.toLowerCase() === value.trim().toLowerCase(),
        ),
      );
      setOpen(true);
    }, [options, value]);

    const select = (option: string) => {
      onValueChange(option);
      setOpen(false);
      setFiltering(false);
    };

    const close = React.useCallback(() => setOpen(false), []);
    useDismissOnOutsidePointer(containerRef, open, close);

    React.useEffect(() => {
      if (!open || activeIndex < 0) return;
      const item = listRef.current?.children[activeIndex] as
        | HTMLElement
        | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!open) {
            openList();
            return;
          }
          setActiveIndex((index) =>
            filtered.length === 0 ? -1 : (index + 1) % filtered.length,
          );
          return;
        case "ArrowUp":
          event.preventDefault();
          if (!open) {
            openList();
            return;
          }
          setActiveIndex((index) =>
            filtered.length === 0
              ? -1
              : (index - 1 + filtered.length) % filtered.length,
          );
          return;
        case "Enter":
          if (open && activeIndex >= 0 && filtered[activeIndex]) {
            event.preventDefault();
            select(filtered[activeIndex]);
          }
          return;
        case "Escape":
          if (open) {
            event.preventDefault();
            setOpen(false);
          }
          return;
        case "Tab":
          setOpen(false);
          return;
      }
    };

    const activeOptionId =
      open && activeIndex >= 0 && filtered[activeIndex]
        ? `${listboxId}-${activeIndex}`
        : undefined;

    return (
      <div ref={containerRef} className="relative">
        <input
          {...props}
          ref={setRefs}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setFiltering(true);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onClick={() => {
            if (!open) openList();
          }}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 pr-10 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Hide suggestions" : "Show suggestions"}
          disabled={disabled}
          // Keep focus in the input so blur validation does not fire.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else openList();
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {filtered.length > 0 ? (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                className="max-h-64 overflow-y-auto p-1 [scrollbar-width:thin]"
              >
                {filtered.map((option, index) => {
                  const selected =
                    option.toLowerCase() === value.trim().toLowerCase();
                  const active = index === activeIndex;
                  return (
                    <li
                      key={option}
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(option)}
                      className={cn(
                        "flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-card-foreground",
                        active && "bg-accent text-accent-foreground",
                        selected && "font-medium",
                      )}
                    >
                      <span className="truncate">{option}</span>
                      {selected ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p
                id={listboxId}
                className="px-3 py-2.5 text-sm text-muted-foreground"
              >
                {emptyMessage}
              </p>
            )}
          </div>
        ) : null}
      </div>
    );
  },
);
