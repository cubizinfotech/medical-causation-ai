# EWI report workflow

The final Expert Witness Investigation output is a Microsoft Word document. MCA and EWI share the report renderer. Each product keeps its own template.

## Shared renderer

`apps/api/src/platform/report/` defines a product-neutral document model (`ReportDocumentModel`) and `DocxReportRenderer`. The renderer uses the `docx` library already used by the API. It applies heading styles, header, footer, page numbers, hyperlinks, optional table-of-contents field, and document metadata. It does not choose section content.

`ReportModule` provides that renderer. EWI imports the module. MCA PDF export is unchanged.

## EWI template

`apps/api/src/modules/ewi/report/ewi-report.template.ts` builds template `ewi/investigation-report` version `2.0.0`. The document always contains the sections below. A section with no collected record says the information could not be verified and does not infer a qualification.

Report metadata on the cover includes expert name, city, specialty, investigation date, template id/version, and an attorney-review disclaimer. A Word TOC field is inserted when supported; open the file in Microsoft Word and update fields if the TOC entries are blank.

1. Expert Name
2. City
3. Specialty
4. Investigation Date
5. Executive Summary
6. Expert Background
7. Inconsistencies in Background
8. CV Comparison
9. Education and Degrees
10. University Accreditation
11. Licenses
12. State Licensing/Board Actions
13. Board Certifications
14. Certification Organizations
15. Memberships
16. Publications
17. Grants
18. Patents
19. Awards/Military Claims
20. Expert Websites
21. IME/Advertising
22. Expert Directories
23. Orders
24. Pleadings/Motions
25. Depositions
26. Testimony Inconsistencies
27. Income/Bias
28. Lawsuits/Malpractice
29. Criminal Records
30. Social Media
31. Videos/Transcripts
32. News/Blogs
33. University Rules
34. Corporate Affiliations
35. Patient Reviews
36. Office/Location Findings
37. Miscellaneous Findings
38. Overall Research Findings
39. Source Index
40. Cross-Examination Questions

### Important section behavior

- **Inconsistencies** are a primary focus. Entries highlight collected conflicts such as graduation years, license dates, specialty claims, missing publications/authorship, memberships, expired licenses, disciplinary actions, CV conflicts, and testimony inconsistencies. Labels come from collected comparisons only.
- **Orders** are prioritized (limiting, striking, critical, credibility, qualification-related) then chronological. Each entry includes case, case number, date, finding, source link, and evidence reference when collected. Page numbers are never invented.
- **Pleadings/motions** are chronological with brief descriptions and source links.
- **Depositions** include case, date, source, and summary, with a separate **Testimony Inconsistencies** comparison section.
- **Income/Bias** is chronological. Forensic/defense percentages and rates appear only when the source stated them.
- **Publications** list authors, date, journal, source, first/lead author status, and retraction status when available.
- **Memberships** compare CV claims against verified public membership information when both are present.
- **Social media** provides links and factual summaries of relevant public content.
- Restricted items keep title and link. Body text is not copied. The report does not claim a PDF was saved unless storage was legally permitted and actually performed.

## Cross-examination questions

`buildGroundedCrossExamQuestions` writes aggressive leading questions stored on the investigation and printed in section 40.

- Each question names a collected finding or a collected discrepancy.
- When at least one finding exists, the list reaches 100 leading questions by varying the examination angle on those findings.
- When no finding exists, the list is empty unless the investigation analysis layer already produced grounded uncertainty questions from source attempts.
- An unverified, conflicting, or restricted item is described with that status. The question does not treat it as a confirmed credential.

## Storage and download

Raw research stays in `ewi.research_findings`. The generated file is a local `.docx` under `knowledge-base/ewi/reports/investigations/{jobId}.docx`. `ewi.investigation_reports` stores the file name, MIME type, storage key, byte size, template id, and template version. It does not store third-party document bodies.

`GET /ewi/histories/:id/report` downloads that file. The history page uses the same route.
