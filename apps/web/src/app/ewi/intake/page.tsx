import { Search } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { ExpertIntakeForm } from "@/components/ewi/expert-intake-form";

export default function EwiIntakePage() {
  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/30 to-background">
      <PageContainer className="pb-10 pt-10">
        <div className="mb-8 max-w-2xl">
          <Badge variant="secondary" className="mb-3">
            Expert Witness Investigation
          </Badge>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Expert Intake
              </h1>
              <p className="mt-1 text-muted-foreground">
                Provide the expert name and medical specialty to begin automated
                research and report generation.
              </p>
            </div>
          </div>
        </div>
        <ExpertIntakeForm />
      </PageContainer>
    </div>
  );
}
