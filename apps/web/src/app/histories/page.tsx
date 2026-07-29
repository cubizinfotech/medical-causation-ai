import { History } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import HistoriesView from "./histories-view";

export default function HistoriesPage() {
  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/20 to-background">
      <PageContainer className="py-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="secondary" className="mb-2">
              Case History
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">
              Analysis Histories
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              All submitted medical cases are saved here. Open any row to view
              live progress or the final report.
            </p>
          </div>
        </div>
        <HistoriesView />
      </PageContainer>
    </div>
  );
}
