# How the application works

This application helps personal injury attorneys. It is legal research assistance. It is not a hospital system, an electronic medical record, or a diagnosis tool.

Two products share one website, one API, one PostgreSQL database, and one Redis queue. Their screens, data, and code stay separate.

## Medical Causation Analysis

**Purpose.** Help an attorney study whether a trauma or accident medically contributed to an injury or disease. The attorney reviews the result. The software does not issue a medical opinion.

**What you enter.** What happened, the injury or condition, and the history you choose to include.

**Flow.**

1. Open the site and choose Medical Causation Analysis.
2. Fill in the case, or load an example.
3. The API stores the case and runs the analysis in the background.
4. The screen shows progress.
5. The application searches the indexed knowledge base (your medical books and articles).
6. The AI model writes the analysis only from passages it was given. If evidence is missing, the result says so.
7. You read the on-screen report: analysis, supporting and opposing evidence, citations, and cross-examination questions.
8. Past cases stay in history.

The knowledge-base files are not in Git. Copy them onto the server and index them before a live analysis can cite them. Steps are in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Expert Witness Investigation

**Purpose.** Help an attorney prepare to question an opposing medical expert. The investigation records what sources support, and it records when something cannot be verified.

**What you enter.** Expert name, city, and medical specialty.

**Flow.**

1. Open Expert Witness Investigation.
2. Enter the expert and start the investigation.
3. A background job walks the stages: identification, profiles, education, licenses, board certifications, publications, grants, patents, legal research, orders, motions, depositions, directories, websites, videos, social media, news, university research, and income or bias.
4. You watch the timeline. You can cancel. Retry starts a new investigation with the same name, city, and specialty.
5. Sources that are missing, restricted, or failing stay marked that way. The job does not invent a degree, license, or lawsuit.
6. The finished page shows the summary, findings, inconsistencies, sources, and cross-examination questions.
7. Download the Microsoft Word report.

Local and server demos use sample research records (`RESEARCH_PROVIDER=mock`). Live paid databases are not connected. A missing source is not proof that the expert lacks a credential.

## Shared pieces

| Piece | Role |
|-------|------|
| Website | Next.js at port 3000 |
| API | NestJS at port 3001 |
| PostgreSQL | Cases, investigations, and knowledge-base vectors |
| Redis | Background job queue |
| AI model | Phrases the analysis from retrieved evidence. It is not the source of facts |
| Email | Logged locally. Not sent until delivery is turned on |

Login can stay off for a private demo. When `AUTH_ENABLED=true`, the same accounts cover both products. Law-firm separation is not built yet.
