"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { useDismissOnOutsidePointer } from "./popover";
import { Input } from "./input";

export type ComboboxOption = string | { label: string; category?: string };

export interface ComboboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "list" | "role"
  > {
  value: string;
  onValueChange: (value: string) => void;
  /** Suggestions only. Free text is still accepted. */
  options: readonly ComboboxOption[];
  emptyMessage?: string;
}

function optionLabel(option: ComboboxOption): string {
  return typeof option === "string" ? option : option.label;
}

function optionCategory(option: ComboboxOption): string | undefined {
  return typeof option === "string" ? undefined : option.category;
}

function groupOptions(
  options: readonly ComboboxOption[],
): Array<{ category: string | null; items: ComboboxOption[] }> {
  const groups: Array<{ category: string | null; items: ComboboxOption[] }> = [];
  const index = new Map<string, number>();
  for (const option of options) {
    const category = optionCategory(option) ?? "";
    const existing = index.get(category);
    if (existing === undefined) {
      index.set(category, groups.length);
      groups.push({
        category: category || null,
        items: [option],
      });
    } else {
      groups[existing].items.push(option);
    }
  }
  return groups;
}

/**
 * Text field with type-ahead suggestions. The typed value is always kept;
 * picking a suggestion is optional. The list opens only after the user types.
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
    const listRef = React.useRef<HTMLUListElement>(null);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);

    const query = value.trim();
    const filtered = React.useMemo(() => {
      const needle = query.toLowerCase();
      if (!needle) return [];
      const matches: ComboboxOption[] = [];
      for (const option of options) {
        if (optionLabel(option).toLowerCase().includes(needle)) {
          matches.push(option);
          if (matches.length >= 40) break;
        }
      }
      return matches;
    }, [options, query]);

    const groups = React.useMemo(() => groupOptions(filtered), [filtered]);
    const flat = filtered;
    const listVisible = open && query.length > 0;

    const close = React.useCallback(() => setOpen(false), []);
    useDismissOnOutsidePointer(containerRef, listVisible, close);

    React.useEffect(() => {
      if (!listVisible || activeIndex < 0) return;
      const item = listRef.current?.querySelector(
        `[data-combo-index="${activeIndex}"]`,
      ) as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, listVisible]);

    const select = (option: ComboboxOption) => {
      onValueChange(optionLabel(option));
      setOpen(false);
      setActiveIndex(-1);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (query.length === 0) return;
          setOpen(true);
          setActiveIndex((index) =>
            flat.length === 0 ? -1 : (index + 1) % flat.length,
          );
          return;
        case "ArrowUp":
          event.preventDefault();
          if (query.length === 0) return;
          setOpen(true);
          setActiveIndex((index) =>
            flat.length === 0
              ? -1
              : (index - 1 + flat.length) % flat.length,
          );
          return;
        case "Enter":
          if (listVisible && activeIndex >= 0 && flat[activeIndex]) {
            event.preventDefault();
            select(flat[activeIndex]);
          }
          return;
        case "Escape":
          if (listVisible) {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          }
          return;
        case "Tab":
          setOpen(false);
          return;
      }
    };

    const activeOptionId =
      listVisible && activeIndex >= 0 && flat[activeIndex]
        ? `${listboxId}-${activeIndex}`
        : undefined;

    let optionIndex = -1;

    return (
      <div ref={containerRef} className="relative">
        <Input
          {...props}
          ref={forwardedRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={listVisible}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setActiveIndex(-1);
            setOpen(event.target.value.trim().length > 0);
          }}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={className}
        />

        {listVisible ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {flat.length > 0 ? (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                className="max-h-64 overflow-y-auto p-1 [scrollbar-width:thin]"
              >
                {groups.map((group) => (
                  <React.Fragment
                    key={group.category ?? group.items.map(optionLabel).join("|")}
                  >
                    {group.category ? (
                      <li
                        role="presentation"
                        className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {group.category}
                      </li>
                    ) : null}
                    {group.items.map((option) => {
                      optionIndex += 1;
                      const index = optionIndex;
                      const label = optionLabel(option);
                      const selected =
                        label.toLowerCase() === value.trim().toLowerCase();
                      const active = index === activeIndex;
                      return (
                        <li
                          key={`${group.category ?? "option"}-${label}`}
                          id={`${listboxId}-${index}`}
                          data-combo-index={index}
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
                          <span className="truncate">{label}</span>
                          {selected ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </React.Fragment>
                ))}
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
