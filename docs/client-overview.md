# Client overview

This page explains the product in plain language. The same story is on the visual page [index.html](./index.html). Technical setup is in [demo-guide.md](./demo-guide.md) and [digitalocean.md](./digitalocean.md).

The system is legal research software for attorneys. It is not a hospital record system and it does not diagnose patients.

Two products share one sign-in, one database, and one place to run background work. They can be separated later.

## Medical Causation Analysis

**Purpose.** Help an attorney study whether a trauma or accident medically contributed to an injury or a disease, using the firm’s documents and the configured medical literature.

**User input.** Case details such as the incident, the injury, and the medical history the attorney chooses to enter. File upload on the form is shown in the demo. Those files are not yet sent to the analysis service.

**Workflow.** The attorney submits the case. The application searches the indexed knowledge base, asks the configured AI model to reason over that evidence, and saves a structured result. Progress is shown on screen. If a source is missing, the result says the evidence was not available.

**Output.** An on-screen report with the analysis, supporting and opposing evidence, citations, and cross-examination questions for the attorney to review. This is research assistance. It is not a medical opinion.

**Major features.** Case intake, background processing, knowledge-base search, citation checks, case history, and a report view.

## Expert Witness Investigation

**Purpose.** Help an attorney prepare to question an opposing medical expert.

**User input.** The expert’s name and medical specialty.

**Workflow.** The attorney starts one investigation. The application then works through profile, education, licenses, publications, legal mentions, public pages, and related checks. It does not stop for approval at every step. If a source is unavailable, the investigation continues and records that fact. It does not invent a degree, license, or case.

**Output.** A finished investigation on screen and a Microsoft Word report. The report includes a summary, findings, discrepancies, source links, limitations, and at least 100 cross-examination questions when the collected evidence supports them. Unverified points stay unverified.

**Major features.** Twenty-two research stages, live progress, source status, discrepancy notes, grounded questions, and a Word download.

## Demo users and roles

Local demonstration accounts can be created with `npm run seed:demo-users`. They are not production users.

| Role | What they can open when login is turned on |
|------|-----------------------------------------------|
| Super Admin | Both products and the user list |
| Admin | Both products and the user list |
| Attorney | Both products |
| Paralegal | Both products |
| Medical Expert | Both products |
| User | Both products |

Emails and the local demo password are listed in [authentication.md](./authentication.md). Login can stay off for a local tour.

## Local development

Developers run the database and background queue in Docker on a laptop. The website is `http://localhost:3000`. No DigitalOcean machine is required. No paid API account is required. Expert research uses sample fixtures. Email is written to the log instead of being sent. A live medical analysis is the one step that needs a chat model, and a free tier is enough.

## Production architecture

The planned host is one DigitalOcean server running the website, the API, PostgreSQL, and Redis in containers, with HTTPS in front. Research vendors and outbound email stay off until the client confirms them. Details are in [digitalocean.md](./digitalocean.md).

## AI provider

The application asks one shared AI service for a completion. The service can use different model vendors. Business screens do not contain a vendor name. The model may only discuss evidence the application retrieved. If the model adds a fact that was not retrieved, that output is rejected.

## Research provider

Expert research goes through one catalog of sources. Each source can be a free public API, a paid account, or a manual check. None of them are called in local development. A missing source is reported as unavailable. It is not treated as proof that the expert lacks a credential.

## Report generation

Medical Causation Analysis presents the report in the browser. Expert Witness Investigation also builds a versioned Word document from the collected findings. The two products share the Word renderer and keep separate templates. Restricted source text is not copied into the Word file.

## Deployment overview

Local machines use Docker for the database and Redis. Production is a separate step on DigitalOcean and is documented for when the client is ready. Backups are not part of that deployment until they are approved.

## Related

- [index.html](./index.html)
- [demo-guide.md](./demo-guide.md)
- [ewi-workflow.md](./ewi-workflow.md)
- [authentication.md](./authentication.md)
- [digitalocean.md](./digitalocean.md)
