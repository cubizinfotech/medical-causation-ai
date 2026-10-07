"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  popoverSide,
  useDismissOnOutsidePointer,
  type PopoverSide,
} from "./popover";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PANEL_HEIGHT = 380;

type CalendarView = "days" | "months" | "years";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD as a local date. Returns null for impossible dates. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Formats typed digits as YYYY-MM-DD so users never type the dashes. */
function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export interface DatePickerProps {
  id?: string;
  name?: string;
  /** YYYY-MM-DD, or partial text while the user is typing. */
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  /** Prevents picking a date after today. */
  disableFuture?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Typeable YYYY-MM-DD field with a themed calendar popover. */
export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
      id,
      name,
      value,
      onValueChange,
      onBlur,
      disableFuture = false,
      placeholder = "YYYY-MM-DD",
      disabled,
      className,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
    },
    forwardedRef,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const dialogId = `${inputId}-calendar`;
    const containerRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const gridRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);
    const [side, setSide] = React.useState<PopoverSide>("bottom");
    const [view, setView] = React.useState<CalendarView>("days");
    const [today, setToday] = React.useState<Date | null>(null);
    const [focusDate, setFocusDate] = React.useState<Date>(() => new Date(2000, 0, 1));
    const [yearPageStart, setYearPageStart] = React.useState(2000);

    const selectedDate = parseIsoDate(value);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const close = React.useCallback(() => setOpen(false), []);
    useDismissOnOutsidePointer(containerRef, open, close);

    // Move keyboard focus to the highlighted day whenever it changes.
    React.useEffect(() => {
      if (!open || view !== "days") return;
      gridRef.current
        ?.querySelector<HTMLButtonElement>('[data-focused="true"]')
        ?.focus();
    }, [focusDate, open, view]);

    const isDisabledDay = (date: Date): boolean =>
      disableFuture && !!today && date.getTime() > today.getTime();

    const openCalendar = () => {
      const now = startOfToday();
      const start = selectedDate ?? now;
      setToday(now);
      setFocusDate(start);
      setYearPageStart(Math.floor(start.getFullYear() / 12) * 12);
      setView("days");
      if (containerRef.current) {
        setSide(popoverSide(containerRef.current, PANEL_HEIGHT));
      }
      setOpen(true);
    };

    const closeAndFocusInput = () => {
      setOpen(false);
      inputRef.current?.focus();
    };

    const choose = (date: Date) => {
      if (isDisabledDay(date)) return;
      onValueChange(toIsoDate(date));
      closeAndFocusInput();
    };

    const moveFocus = (next: Date) => {
      if (isDisabledDay(next) && today) {
        setFocusDate(today);
        return;
      }
      setFocusDate(next);
    };

    const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const steps: Record<string, () => Date> = {
        ArrowLeft: () => addDays(focusDate, -1),
        ArrowRight: () => addDays(focusDate, 1),
        ArrowUp: () => addDays(focusDate, -7),
        ArrowDown: () => addDays(focusDate, 7),
        Home: () => addDays(focusDate, -focusDate.getDay()),
        End: () => addDays(focusDate, 6 - focusDate.getDay()),
        PageUp: () => addMonths(focusDate, event.shiftKey ? -12 : -1),
        PageDown: () => addMonths(focusDate, event.shiftKey ? 12 : 1),
      };
      const step = steps[event.key];
      if (step) {
        event.preventDefault();
        moveFocus(step());
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(focusDate);
      }
    };

    const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (view === "days") closeAndFocusInput();
        else setView("days");
      }
    };

    const viewYear = focusDate.getFullYear();
    const viewMonth = focusDate.getMonth();
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
    const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
    const nextMonthDisabled =
      disableFuture &&
      !!today &&
      new Date(viewYear, viewMonth + 1, 1).getTime() > today.getTime();

    const headerButton =
      "rounded-md px-2 py-1 text-sm font-semibold text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    const navButton =
      "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";
    const tileButton =
      "flex h-11 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";

    const renderHeader = () => {
      if (view === "days") {
        return (
          <>
            <button
              type="button"
              className={navButton}
              aria-label="Previous month"
              onClick={() => setFocusDate(addMonths(focusDate, -1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className={headerButton}
              aria-label="Choose month and year"
              onClick={() => setView("months")}
            >
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button
              type="button"
              className={navButton}
              aria-label="Next month"
              disabled={nextMonthDisabled}
              onClick={() => setFocusDate(addMonths(focusDate, 1))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </>
        );
      }
      if (view === "months") {
        return (
          <>
            <button
              type="button"
              className={navButton}
              aria-label="Previous year"
              onClick={() => setFocusDate(addMonths(focusDate, -12))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className={headerButton}
              aria-label="Choose year"
              onClick={() => {
                setYearPageStart(Math.floor(viewYear / 12) * 12);
                setView("years");
              }}
            >
              {viewYear}
            </button>
            <button
              type="button"
              className={navButton}
              aria-label="Next year"
              disabled={disableFuture && !!today && viewYear >= today.getFullYear()}
              onClick={() => setFocusDate(addMonths(focusDate, 12))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </>
        );
      }
      return (
        <>
          <button
            type="button"
            className={navButton}
            aria-label="Previous years"
            onClick={() => setYearPageStart(yearPageStart - 12)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="px-2 py-1 text-sm font-semibold text-card-foreground">
            {yearPageStart} – {yearPageStart + 11}
          </span>
          <button
            type="button"
            className={navButton}
            aria-label="Next years"
            disabled={
              disableFuture && !!today && yearPageStart + 12 > today.getFullYear()
            }
            onClick={() => setYearPageStart(yearPageStart + 12)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      );
    };

    const renderBody = () => {
      if (view === "years") {
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => yearPageStart + index).map(
              (year) => {
                const isSelectedYear = selectedDate?.getFullYear() === year;
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={disableFuture && !!today && year > today.getFullYear()}
                    onClick={() => {
                      setFocusDate(new Date(year, viewMonth, 1));
                      setView("months");
                    }}
                    className={cn(
                      tileButton,
                      year === viewYear && "ring-1 ring-inset ring-primary/40",
                      isSelectedYear &&
                        "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                  >
                    {year}
                  </button>
                );
              },
            )}
          </div>
        );
      }

      if (view === "months") {
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((month, index) => {
              const isSelectedMonth =
                selectedDate?.getFullYear() === viewYear &&
                selectedDate.getMonth() === index;
              return (
                <button
                  key={month}
                  type="button"
                  disabled={
                    disableFuture &&
                    !!today &&
                    new Date(viewYear, index, 1).getTime() > today.getTime()
                  }
                  onClick={() => {
                    const lastDay = new Date(viewYear, index + 1, 0).getDate();
                    setFocusDate(
                      new Date(viewYear, index, Math.min(focusDate.getDate(), lastDay)),
                    );
                    setView("days");
                  }}
                  className={cn(
                    tileButton,
                    isSelectedMonth &&
                      "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {month.slice(0, 3)}
                </button>
              );
            })}
          </div>
        );
      }

      return (
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${MONTHS[viewMonth]} ${viewYear}`}
          onKeyDown={handleGridKeyDown}
        >
          <div role="row" className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                role="columnheader"
                className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div role="row" key={week} className="grid grid-cols-7 gap-0.5">
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const outside = date.getMonth() !== viewMonth;
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const isFocused = isSameDay(date, focusDate);
                const isDisabled = isDisabledDay(date);
                return (
                  <button
                    key={date.getTime()}
                    type="button"
                    role="gridcell"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused}
                    aria-selected={isSelected}
                    aria-label={date.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    disabled={isDisabled}
                    onClick={() => choose(date)}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                      outside ? "text-muted-foreground/60" : "text-card-foreground",
                      isToday &&
                        !isSelected &&
                        "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                      isSelected &&
                        "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div ref={containerRef} className="relative">
        <input
          ref={setRefs}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          onChange={(event) => onValueChange(maskDateInput(event.target.value))}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && event.altKey) {
              event.preventDefault();
              openCalendar();
            }
          }}
          className={cn(
            "flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 pr-12 text-sm tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
            open && "border-primary/50 ring-2 ring-ring/30",
            className,
          )}
        />
        <button
          type="button"
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          disabled={disabled}
          onClick={() => (open ? closeAndFocusInput() : openCalendar())}
          className={cn(
            "absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
            open && "bg-accent text-accent-foreground",
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
        </button>

        {open ? (
          <div
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-label="Choose date"
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            onBlur={(event) => {
              // Close when keyboard focus leaves. A null relatedTarget is a
              // click (Safari does not focus buttons); outside clicks are
              // handled by useDismissOnOutsidePointer.
              const next = event.relatedTarget as Node | null;
              if (next && !containerRef.current?.contains(next)) {
                setOpen(false);
              }
            }}
            className={cn(
              "absolute left-0 z-50 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lg outline-none",
              side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              {renderHeader()}
            </div>
            {renderBody()}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onValueChange("");
                  closeAndFocusInput();
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => choose(startOfToday())}
              >
                Today
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
