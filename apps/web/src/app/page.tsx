import Link from "next/link";
import { ArrowRight, Scale, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout";

export default function ProductChooserPage() {
  return (
    <PageContainer size="wide" className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Legal Research AI Platform
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Choose a product. Medical Causation Analysis (MCA) and Expert Witness
          Investigation (EWI) share infrastructure but keep separate workflows,
          data, and reports.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8 text-left shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Medical Causation Analysis</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Evaluate whether trauma or accidents medically contributed to injury
            or disease with RAG-backed causation reports.
          </p>
          <Button asChild className="mt-6">
            <Link href="/mca">
              Open MCA
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-left shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Expert Witness Investigation</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Research opposing experts and generate a Microsoft Word report with
            100+ evidence-based cross-examination questions.
          </p>
          <Button asChild className="mt-6">
            <Link href="/ewi">
              Open EWI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
