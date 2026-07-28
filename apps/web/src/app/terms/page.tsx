import { PageContainer } from "@/components/layout";

export default function TermsPage() {
  return (
    <PageContainer size="narrow" className="py-12">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 28, 2026
      </p>

      <div className="prose prose-slate mt-10 max-w-none space-y-8 text-sm leading-7 text-foreground">
        <section>
          <h2 className="text-xl font-semibold">No Medical Advice</h2>
          <p className="mt-3 text-muted-foreground">
            Medical Causation AI is provided for informational and educational
            purposes only. The software does not provide medical advice,
            diagnosis, or treatment recommendations. It does not replace
            evaluation by licensed healthcare professionals. Users should not
            rely on the software for medical decisions. Always consult qualified
            medical providers for health-related matters.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">No Warranty</h2>
          <p className="mt-3 text-muted-foreground">
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL
            WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE THE ACCURACY,
            COMPLETENESS, OR CURRENCY OF ANY OUTPUT. WE DO NOT GUARANTEE
            UNINTERRUPTED OR ERROR-FREE SERVICE. RESEARCH RESULTS MAY BE
            INCOMPLETE OR OUTDATED.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Limitation of Liability</h2>
          <p className="mt-3 text-muted-foreground">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, MEDICAL CAUSATION AI AND ITS
            AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
            ARISING FROM YOUR USE OF THE SOFTWARE. OUR TOTAL LIABILITY FOR ANY
            CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE
            TWELVE MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100),
            WHICHEVER IS GREATER.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Arbitration</h2>
          <p className="mt-3 text-muted-foreground">
            Any dispute arising from these Terms or your use of the software
            shall be resolved by binding arbitration in California under the
            Commercial Arbitration Rules of the American Arbitration Association
            (AAA). YOU WAIVE ANY RIGHT TO A JURY TRIAL. YOU AGREE THAT DISPUTES
            WILL BE RESOLVED ONLY ON AN INDIVIDUAL BASIS AND NOT AS A CLASS
            ACTION, CONSOLIDATED ACTION, OR REPRESENTATIVE ACTION.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Governing Law</h2>
          <p className="mt-3 text-muted-foreground">
            These Terms are governed by the laws of the State of California,
            without regard to conflict-of-law principles.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
