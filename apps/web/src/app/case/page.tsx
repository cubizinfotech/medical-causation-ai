import { PageContainer, SectionHeader } from "@/components/layout";
import { CaseForm } from "@/components/demo";

export default function CasePage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Medical Case Intake"
        description="Enter patient, accident, and medical details for AI causation analysis. All fields marked required must be completed."
      />
      <CaseForm />
    </PageContainer>
  );
}
