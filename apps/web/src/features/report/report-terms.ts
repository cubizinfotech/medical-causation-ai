export interface ReportPolicySection {
  title: string;
  body: string;
}

export const REPORT_POLICY_SECTIONS: ReportPolicySection[] = [
  {
    title: "No Medical Advice",
    body:
      "Medical Causation AI is provided for informational and legal research purposes only. " +
      "The software does not provide medical advice, diagnosis, or treatment recommendations. " +
      "It does not replace evaluation by licensed healthcare professionals.",
  },
  {
    title: "No Warranty",
    body:
      'THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. ' +
      "We do not guarantee the accuracy, completeness, or currency of any output. " +
      "Research results may be incomplete or outdated.",
  },
  {
    title: "Limitation of Liability",
    body:
      "To the maximum extent permitted by law, Medical Causation AI and its affiliates shall not be " +
      "liable for any indirect, incidental, special, consequential, or punitive damages arising from " +
      "your use of the software or reliance on this report.",
  },
  {
    title: "Privacy",
    body:
      "Case data is processed to generate this report. Do not include real patient identifiers in " +
      "demonstration deployments without appropriate HIPAA-compliant infrastructure. " +
      "We do not sell personal information.",
  },
  {
    title: "Arbitration & Governing Law",
    body:
      "Any dispute arising from use of the software shall be resolved by binding arbitration in " +
      "California under AAA Commercial Arbitration Rules. These Terms are governed by the laws of " +
      "the State of California.",
  },
];

export const REPORT_POLICY_FOOTER =
  "By using this report you acknowledge these terms. Full Terms of Use and Privacy Policy are available at /terms and /privacy.";
