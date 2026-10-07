"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  popoverSide,
  useDismissOnOutsidePointer,
  type PopoverSide,
} from "./popover";

export interface SelectOption {
  value: string;
  label: string;
}

export interface ListboxSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const OPTION_HEIGHT = 40;
const PANEL_MAX_HEIGHT = 264;

/**
 * Styled single-choice select. Replaces the native <select>, whose option
 * list is drawn by the browser and cannot be themed.
 */
export const ListboxSelect = React.forwardRef<
  HTMLButtonElement,
  ListboxSelectProps
>(function ListboxSelect(
  {
    id,
    value,
    onValueChange,
    onBlur,
    options,
    placeholder = "Select…",
    disabled,
    className,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
  },
  forwardedRef,
) {
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const typeaheadRef = React.useRef({ text: "", timer: 0 });
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<PopoverSide>("bottom");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = React.useCallback(() => setOpen(false), []);
  useDismissOnOutsidePointer(containerRef, open, close);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const item = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = (index = Math.max(selectedIndex, 0)) => {
    if (containerRef.current) {
      setSide(
        popoverSide(
          containerRef.current,
          Math.min(PANEL_MAX_HEIGHT, options.length * OPTION_HEIGHT + 8),
        ),
      );
    }
    setActiveIndex(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    setOpen(false);
  };

  const findByTypeahead = (key: string): number => {
    const state = typeaheadRef.current;
    window.clearTimeout(state.timer);
    state.text += key.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.text = "";
    }, 500);
    return options.findIndex((option) =>
      option.label.toLowerCase().startsWith(state.text),
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey) {
      const match = findByTypeahead(event.key);
      if (match >= 0) {
        if (open) setActiveIndex(match);
        else onValueChange(options[match].value);
      }
      return;
    }

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        return;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={forwardedRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          open && "border-primary/50 ring-2 ring-ring/30",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className={cn(
            "absolute left-0 right-0 z-50 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg [scrollbar-width:thin]",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          )}
          style={{ maxHeight: PANEL_MAX_HEIGHT }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-card-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground",
                  isSelected && "font-medium",
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
});
