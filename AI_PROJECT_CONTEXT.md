# Medical Causation AI Platform

You are acting as a Principal Software Architect, Senior Full Stack Engineer, AI Engineer, and DevOps Engineer.

We are building a production-ready enterprise SaaS application called **Medical Causation AI**.

This application is NOT a hospital system, EMR, appointment system, or medical diagnosis software.

Its primary purpose is to help Personal Injury Attorneys determine whether a trauma or accident medically contributed to a patient's injury or disease using scientific evidence, epidemiology, AI reasoning, and peer-reviewed medical literature.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPLICATION PURPOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The application should help attorneys answer questions like:

• Did a car accident contribute to a patient's stroke?
• Did trauma worsen a spinal injury?
• Did a workplace accident increase the risk of a disease?
• Can scientific evidence support medical causation?

Instead of manually reading hundreds of medical papers, the application should automatically:

1. Collect patient and accident information.
2. Search trusted medical research databases.
3. Retrieve relevant scientific evidence.
4. Search the client's private knowledge base (PDFs & Books).
5. Analyze evidence using AI.
6. Apply accepted medical causation principles.
7. Calculate probability and confidence.
8. Generate attorney-ready professional reports with citations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAIN FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The application will eventually include:

• Multi-tenant SaaS
• Law Firm Management
• Attorney Management
• Paralegal Management
• Medical Expert Management
• Authentication & Authorization
• Medical Case Management
• AI Research Assistant
• Medical Knowledge Base
• PDF Upload & Parsing
• Retrieval Augmented Generation (RAG)
• Medical Literature Search
• Scientific Citation Management
• Medical Causation Analysis
• Probability Calculator
• Professional PDF Report Generator
• Admin Panel
• Audit Logs
• Notifications
• Subscription & Billing (future)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICAL DATA SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The application will integrate with:

• PubMed
• PubMed Central (PMC)
• ClinicalTrials.gov
• Crossref
• Semantic Scholar
• CDC
• WHO
• Client Private Knowledge Base
• Uploaded PDFs
• Medical Textbooks (licensed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECH STACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend
---------
• Next.js (App Router)
• TypeScript
• Tailwind CSS
• Shadcn/UI
• TanStack Query
• React Hook Form
• Zod

Backend
--------
• NestJS
• TypeScript
• Prisma ORM
• PostgreSQL
• pgvector
• Redis
• BullMQ
• Swagger

AI
--
• Vercel AI SDK
• LangChain

Supported AI Providers
----------------------
• OpenAI
• Anthropic Claude
• Google Gemini
• Azure OpenAI
• OpenRouter

The active provider must be configurable using environment variables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTEM ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The application should follow Clean Architecture and be modular.

High-level flow:

Attorney
↓
Create Medical Case
↓
Search Medical Databases
↓
Search Private Knowledge Base
↓
Retrieve Scientific Evidence
↓
AI Analysis
↓
Medical Causation Engine
↓
Probability Engine
↓
Professional PDF Report
↓
Attorney Download

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always follow these principles:

• Production-ready code only.
• Clean Architecture.
• SOLID principles.
• Feature-based modules.
• Strict TypeScript.
• Reusable components.
• Modular design.
• Enterprise-grade folder structure.
• No duplicated code.
• Proper error handling.
• Proper logging.
• Secure by default.
• Multi-tenant ready.
• API-first architecture.
• Docker-ready.
• Environment-driven configuration.
• Fully documented.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every implementation:

1. Never redesign previously implemented architecture unless explicitly instructed.
2. Never delete existing functionality unless requested.
3. Keep modules independent.
4. Use environment variables for all configurable values.
5. Never hardcode secrets, URLs, credentials, API keys, or magic values.
6. Follow existing naming conventions.
7. Write readable, maintainable code.
8. Prefer composition over duplication.
9. Keep frontend and backend responsibilities separate.
10. Think carefully before generating code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Whenever changes are made:

• Update README.md
• Update TODO.md
• Update CHANGELOG.md
• Update relevant files in /docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not implement features outside the current prompt.

Focus only on the requested task.

At the end of every task provide:

✔ Files Created
✔ Files Modified
✔ Packages Installed
✔ Manual Steps Required
✔ Next Recommended Prompt