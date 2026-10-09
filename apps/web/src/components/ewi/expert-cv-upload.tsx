"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  ScanText,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatPageList } from "@/features/common/format";
import { ewiClient } from "@/features/ewi/ewi.service";
import type { EwiExpertDocumentSummary } from "@/features/ewi/types";
import { cn } from "@/utils/cn";

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The opposing expert's CV (optional, PDF). It uploads as soon as it is
 * chosen; the investigation then reads its claims and checks each one
 * against the public sources.
 */
export function ExpertCvUpload({
  inputId,
  value,
  onChange,
  onBusyChange,
  disabled,
}: {
  inputId: string;
  value: EwiExpertDocumentSummary | null;
  onChange: (document: EwiExpertDocumentSummary | null) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = async (
    kind: "uploading" | "removing",
    task: () => Promise<void>,
    fallback: string,
  ) => {
    setBusy(kind);
    onBusyChange?.(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file || busy || disabled) return;
    if (!/\.pdf$/i.test(file.name)) {
      setError("Only PDF files can be uploaded.");
      return;
    }
    void run(
      "uploading",
      async () => onChange(await ewiClient.uploadCv(file)),
      "The upload failed.",
    );
  };

  const remove = (document: EwiExpertDocumentSummary) =>
    void run(
      "removing",
      async () => {
        await ewiClient.deleteDocument(document.id);
        onChange(null);
      },
      "Could not remove the CV.",
    );

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        accept="application/pdf,.pdf"
        disabled={disabled || busy !== null || value !== null}
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate font-medium">{value.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {value.pageCount} {value.pageCount === 1 ? "page" : "pages"} ·{" "}
                {formatFileSize(value.sizeBytes)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={disabled || busy !== null}
                onClick={() => remove(value)}
                aria-label={`Remove ${value.name}`}
              >
                {busy === "removing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <X className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
          {value.ocrPendingPages.length > 0 ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <ScanText
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                aria-hidden
              />
              {value.ocrPendingPages.length} scanned{" "}
              {value.ocrPendingPages.length === 1 ? "page" : "pages"} (
              {formatPageList(value.ocrPendingPages)}) will be read with OCR
              when the investigation runs.
            </p>
          ) : null}
          {value.unreadablePages.length > 0 ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              {value.unreadablePages.length} scanned or blank{" "}
              {value.unreadablePages.length === 1 ? "page" : "pages"} will be
              skipped ({formatPageList(value.unreadablePages)}).
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/40",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files[0]);
          }}
        >
          {busy === "uploading" ? (
            <p className="flex items-center gap-2 text-sm">
              <Loader2
                className="h-4 w-4 animate-spin text-primary"
                aria-hidden
              />
              Uploading and reading pages…
            </p>
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                Choose PDF
              </Button>
              <span className="text-xs text-muted-foreground">
                or drop the CV here
              </span>
            </>
          )}
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
