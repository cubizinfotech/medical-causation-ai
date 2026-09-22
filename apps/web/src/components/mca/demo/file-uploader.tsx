"use client";

import { useRef } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

interface FileUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  className?: string;
}

export function FileUploader({ files, onChange, className }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (ACCEPTED_EXTENSIONS.includes(ext) && !next.some((f) => f.name === file.name)) {
        next.push(file);
      }
    }
    onChange(next);
  };

  const removeFile = (name: string) => {
    onChange(files.filter((file) => file.name !== name));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Optional document upload</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, TXT, or Markdown — displayed for demo only (not stored)
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>{file.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(file.name)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
