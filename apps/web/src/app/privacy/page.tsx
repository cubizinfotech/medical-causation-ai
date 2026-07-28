import { PageContainer } from "@/components/layout";

export default function PrivacyPage() {
  return (
    <PageContainer size="narrow" className="py-12">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 28, 2026
      </p>

      <div className="mt-10 space-y-6 text-sm leading-7 text-muted-foreground">
        <p>
          Medical Causation AI respects your privacy. This demonstration stores
          case data locally in your browser session and transmits analysis
          requests to our API for processing.
        </p>
        <p>
          We do not sell personal information. Case data entered during the
          demonstration should not include real patient identifiers in
          production deployments without appropriate HIPAA-compliant
          infrastructure.
        </p>
        <p>
          For enterprise deployments, contact your administrator regarding data
          retention, encryption, and access controls.
        </p>
      </div>
    </PageContainer>
  );
}
