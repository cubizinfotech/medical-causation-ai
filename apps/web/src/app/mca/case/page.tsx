import { ClipboardList } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { CaseForm } from "@/components/demo";
import { Badge } from "@/components/ui/badge";

export default function CasePage() {
  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/30 to-background">
      <PageContainer className="pb-10 pt-10">
        <div className="mb-8 max-w-2xl">
            <Badge variant="secondary" className="mb-3">
              Step 1 · Case Intake
            </Badge>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Medical Case Intake
                </h1>
                <p className="mt-1 text-muted-foreground">
                  Enter patient, accident, and medical details for AI causation
                  analysis.
                </p>
              </div>
            </div>
          </div>

        <p className="mb-8 max-w-3xl text-sm leading-6 text-muted-foreground">
          Complete all required fields below, or use <strong>Load Example Case</strong>{" "}
          to pre-fill a realistic mild traumatic brain injury and stroke causation
          scenario. A full copy-paste reference is in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            docs/demo-case-example.md
          </code>{" "}
          at the repository root.
        </p>

        <CaseForm />
      </PageContainer>
    </div>
  );
}
