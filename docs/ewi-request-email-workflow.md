# EWI request and email workflow

EWI can prepare FOIA, university, graduation, employment/activity, follow-up, and TrialSmith outreach messages from structured investigation data. Sending is separate and gated.

The shared mail stack in [email.md](./email.md) still owns delivery. This page covers investigation request preparation, approval, follow-up, and recording.

## What is prepared

| Request type | Template | Intent |
|--------------|----------|--------|
| FOIA / public records | `ewi/foia-request` | Ask for discoverable information about the expert and applicable fees |
| University file | `ewi/university-record-request` | Request education records and ask about charges |
| Graduation announcement | `ewi/graduation-announcement` | Request a graduation announcement for the degree/year and ask about charges |
| University employment / activity | `ewi/university-employment-request` | Request employment or activity information where appropriate |
| Follow-up | `ewi/follow-up-request` | Reference the original request and ask for status (about two weeks later by default) |
| TrialSmith outreach | `ewi/trialsmith-outreach` | Only when specifically configured and authorized |

Templates live in `apps/api/src/modules/ewi/correspondence/`. They are filled from structured fields. The workflow does not invent recipient addresses.

## Configuration

All switches default to safe local behavior. Recipient emails are never hardcoded in source, docs, seeders, or `.env.example`.

| Variable | Default | Role |
|----------|---------|------|
| `EWI_REQUEST_WORKFLOW_ENABLED` | `false` | Master switch. When false, prepare/send do nothing |
| `EWI_REQUEST_AUTO_SEND` | `false` | When true and approval is not required, eligible drafts may send after prepare |
| `EWI_REQUEST_REQUIRE_APPROVAL` | `true` | Requires an explicit approve before send |
| `EWI_REQUEST_FOLLOW_UP_DAYS` | `14` | Days after send before a follow-up is due |
| `EWI_REQUEST_TRIALSMITH_ENABLED` | `false` | TrialSmith outreach only when specifically enabled |
| `EWI_REQUEST_SENDER_NAME` | `Records Counsel` | Display name used in templates |
| `EWI_REQUEST_ALLOW_*` | `true` for most types | Per-type automation. `false` forces manual review |

SMTP and sender credentials stay on the shared email settings (`EMAIL_*`, `SMTP_*`). Do not put a client email password in source, Git, documentation, seeders, `.env.example`, the frontend, or logs.

## When a request is sent

A request is sent only when every gate passes:

1. `EWI_REQUEST_WORKFLOW_ENABLED=true`
2. The request type is allowed (and TrialSmith is specifically enabled when applicable)
3. A valid recipient email is known
4. The request is approved (unless approval is disabled and auto-send is on)
5. Delivery goes through `EmailService` (console locally; configured SMTP in production)

If automation is not appropriate, or the recipient is unknown, the record is `needs_manual_review`. Not every government or university request can legally or technically be automated. Manual review is the supported fallback.

## Local development

Leave:

```
EMAIL_PROVIDER=console
EMAIL_DELIVERY_ENABLED=false
EWI_REQUEST_WORKFLOW_ENABLED=false
```

To exercise preparation without real delivery:

```
EWI_REQUEST_WORKFLOW_ENABLED=true
EWI_REQUEST_REQUIRE_APPROVAL=true
EWI_REQUEST_AUTO_SEND=false
EMAIL_PROVIDER=console
```

Prepared messages are stored on `ewi.investigation_requests`. Approving and sending with the console provider logs the message and records `logged_not_sent`. Nothing is transmitted.

## Production recording

Each request row records:

- investigation id
- request type
- recipient
- subject and body text
- status
- approved by / at
- sent at
- provider and provider message id
- delivered flag
- follow-up date
- delivery / error status

## API surface

All `/ewi/requests` routes require authentication and one of: `attorney`, `paralegal`, `admin`, `super_admin`.  
`POST /ewi/requests/follow-ups/process-due` requires `admin` or `super_admin`.  
Prepare/approve/manual-review bodies are validated DTOs. SMTP credentials are never accepted on these endpoints.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/ewi/requests/prepare` | Build drafts from structured targets |
| `GET` | `/ewi/requests/investigations/:investigationId` | List requests for an investigation |
| `GET` | `/ewi/requests/:id` | Fetch one request |
| `POST` | `/ewi/requests/:id/approve` | Approve for send |
| `POST` | `/ewi/requests/:id/send` | Send when gates pass |
| `POST` | `/ewi/requests/:id/manual-review` | Supply recipient after review |
| `POST` | `/ewi/requests/:id/follow-up` | Create a follow-up draft |
| `POST` | `/ewi/requests/follow-ups/process-due` | Create follow-ups for due parents |

When the workflow is enabled, completing an investigation may also prepare draft candidates from collected education/university evidence. Missing recipients stay in manual review. The investigation job still does not email organizations unless the send gates pass.


## Code

- `apps/api/src/modules/ewi/correspondence/`
- Persistence: `ewi.investigation_requests`
- Shared delivery: `apps/api/src/platform/email`

See also [email.md](./email.md) and [ewi-architecture.md](./ewi-architecture.md).
