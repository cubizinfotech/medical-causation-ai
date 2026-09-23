# EWI report workflow

The final Expert Witness Investigation output is a Microsoft Word document. MCA and EWI share the report renderer. Each product keeps its own template.

## Shared renderer

`apps/api/src/platform/report/` defines a product-neutral document model (`ReportDocumentModel`) and `DocxReportRenderer`. The renderer uses the `docx` library already used by the API. It applies the heading styles, header, footer, page number, and hyperlinks. It does not choose section content.

`ReportModule` provides that renderer. EWI imports the module. MCA PDF export is unchanged.

## EWI template

`apps/api/src/modules/ewi/report/ewi-report.template.ts` builds template `ewi/investigation-report` version `1.0.0`. The document always contains these sections. A section with no collected record says the information could not be verified and does not infer a qualification.

1. Expert Overview
2. Executive Summary
3. Identity/Profile
4. Education and Degrees
5. Medical Licenses
6. Board Certifications
7. Publications and Authorship
8. Grants
9. Patents
10. Awards and Medals
11. Legal/Case Research
12. Expert Witness Directories
13. Expert Websites
14. IME/Advertising Research
15. Videos and Presentations
16. Social Media
17. News and Blogs
18. University/Professional Rules
19. Findings and Discrepancies
20. Sources and Links
21. Research Limitations
22. Cross-Examination Questions

Source URLs are written as links. Restricted items keep the title and link. Their body text is not copied into the report.

## Cross-examination questions

`buildGroundedCrossExamQuestions` writes the questions stored on the investigation and printed in section 22.

- Each question names a collected finding or a collected discrepancy.
- When at least one finding exists, the list reaches 100 leading questions by varying the examination angle on those findings.
- When no finding exists, the list is empty. Facts are not invented to fill it.
- An unverified, conflicting, or restricted item is described with that status. The question does not treat it as a confirmed credential.

The shorter questions inside the analysis JSON stay with the analysis record. The report questions are a separate list built from the same findings.

## Storage and download

Raw research stays in `ewi.research_findings`. The generated file is a local `.docx` under `knowledge-base/ewi/reports/investigations/{jobId}.docx`. `ewi.investigation_reports` stores the file name, MIME type, storage key, byte size, template id, and template version. It does not store third-party document bodies.

`GET /ewi/histories/:id/report` downloads that file. The history page uses the same route.
