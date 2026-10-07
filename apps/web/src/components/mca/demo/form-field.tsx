import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/cn";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Error text uses id `${id}-error`; point the control's aria-describedby at it. */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
