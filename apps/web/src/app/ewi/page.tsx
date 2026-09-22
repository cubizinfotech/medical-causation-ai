import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout";

export default function EwiLandingPage() {
  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Search className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Expert Witness Investigation
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Research an opposing expert&apos;s credentials, publications, legal
          history, and public footprint — then generate a Microsoft Word report
          with 100+ evidence-based cross-examination questions.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/ewi/intake">
              Start Investigation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/ewi/histories">Histories</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
