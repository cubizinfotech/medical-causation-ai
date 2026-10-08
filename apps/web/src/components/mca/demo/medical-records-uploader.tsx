"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseRecordSummary } from "@/features/mca/medical-analysis/types";
import {
  deleteCaseRecord,
  uploadCaseRecord,
} from "@/features/mca/records/case-records.service";
import { formatFileSize, formatPageList } from "@/features/mca/records/format";
import { cn } from "@/utils/cn";

const MAX_FILES = 10;
const MAX_TOTAL_PAGES = 200;

interface PendingUpload {
  key: string;
  name: string;
  status: "uploading" | "error";
  error?: string;
}

interface MedicalRecordsUploaderProps {
  records: CaseRecordSummary[];
  onAdd: (record: CaseRecordSummary) => void;
  onRemove: (id: string) => void;
}

/**
 * Uploads the client's medical records (PDF) as soon as they are chosen.
 * The server reads each file's pages and reports scanned pages it cannot read.
 */
export function MedicalRecordsUploader({
  records,
  onAdd,
  onRemove,
}: MedicalRecordsUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const totalPages = records.reduce((sum, r) => sum + r.pageCount, 0);
  const uploading = pending.some((p) => p.status === "uploading");

  const updatePending = (key: string, change: Partial<PendingUpload> | null) =>
    setPending((current) =>
      change === null
        ? current.filter((p) => p.key !== key)
        : current.map((p) => (p.key === key ? { ...p, ...change } : p)),
    );

  const handleFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const files = Array.from(selected);
    const slots = MAX_FILES - records.length - pending.length;

    const queue: Array<{ key: string; file: File }> = [];
    const rejected: PendingUpload[] = [];
    files.forEach((file, index) => {
      const key = `${Date.now()}-${index}-${file.name}`;
      if (!/\.pdf$/i.test(file.name)) {
        rejected.push({
          key,
          name: file.name,
          status: "error",
          error: "Only PDF files can be uploaded.",
        });
      } else if (queue.length >= slots) {
        rejected.push({
          key,
          name: file.name,
          status: "error",
          error: `You can attach up to ${MAX_FILES} records.`,
        });
      } else {
        queue.push({ key, file });
      }
    });
    setPending((current) => [
      ...current,
      ...queue.map(({ key, file }) => ({
        key,
        name: file.name,
        status: "uploading" as const,
      })),
      ...rejected,
    ]);

    // One at a time: the server reads every page of each file.
    for (const { key, file } of queue) {
      try {
        onAdd(await uploadCaseRecord(file));
        updatePending(key, null);
      } catch (error) {
        updatePending(key, {
          status: "error",
          error:
            error instanceof Error ? error.message : "The upload failed.",
        });
      }
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await deleteCaseRecord(id);
      onRemove(id);
    } catch (error) {
      setPending((current) => [
        ...current,
        {
          key: `remove-${id}`,
          name: records.find((r) => r.id === id)?.name ?? "Record",
          status: "error",
          error:
            error instanceof Error ? error.message : "Could not remove it.",
        },
      ]);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/40",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          Drop the client&apos;s medical records here
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          PDF only, up to {MAX_FILES} files and {MAX_TOTAL_PAGES} pages in
          total. The analysis reads them into a dated chronology cited to the
          page.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={records.length + pending.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
        >
          Choose PDF files
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {records.length > 0 || pending.length > 0 ? (
        <ul className="space-y-2">
          {records.map((record) => (
            <li
              key={record.id}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="truncate font-medium">{record.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {record.pageCount}{" "}
                    {record.pageCount === 1 ? "page" : "pages"} ·{" "}
                    {formatFileSize(record.sizeBytes)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={removing === record.id}
                    onClick={() => void remove(record.id)}
                    aria-label={`Remove ${record.name}`}
                  >
                    {removing === record.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <X className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
              {record.unreadablePages.length > 0 ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  />
                  {record.unreadablePages.length} scanned or blank{" "}
                  {record.unreadablePages.length === 1 ? "page" : "pages"} will
                  be skipped ({formatPageList(record.unreadablePages)}).
                  Scanned pages cannot be read yet.
                </p>
              ) : null}
            </li>
          ))}
          {pending.map((item) => (
            <li
              key={item.key}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
                item.status === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card",
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-medium">
                  {item.status === "uploading" ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-primary"
                      aria-hidden
                    />
                  ) : (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{item.name}</span>
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    item.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {item.status === "uploading"
                    ? "Uploading and reading pages…"
                    : item.error}
                </p>
              </div>
              {item.status === "error" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => updatePending(item.key, null)}
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {records.length > 0 ? (
        <p
          className={cn(
            "text-xs",
            totalPages > MAX_TOTAL_PAGES
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {records.length} {records.length === 1 ? "record" : "records"},{" "}
          {totalPages} pages in total
          {totalPages > MAX_TOTAL_PAGES
            ? ` — over the ${MAX_TOTAL_PAGES}-page limit. Remove a record to continue.`
            : "."}
          {uploading ? " Uploading…" : ""}
        </p>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        Records are stored on this server and only you can open them. To build
        the chronology, their text is sent to the AI provider configured for
        this site. Use a provider your firm has approved for patient records.
      </p>
    </div>
  );
}
