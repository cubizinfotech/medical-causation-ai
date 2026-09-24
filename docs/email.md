# Email

MCA and EWI share one email service in `apps/api/src/platform/email`. Product code calls `EmailService.send`. It does not import SMTP, Nodemailer, or a transactional vendor.

## Providers

| `EMAIL_PROVIDER` | Behavior |
|------------------|----------|
| `console` (default) | Writes the full message to the API log. Nothing is transmitted. |
| `smtp` | Sends with `SMTP_*` only when delivery is enabled and the host is allowed. |
| `transactional` | Reserved seam. No vendor HTTP client is connected. A send fails and is not retried. |

An unknown provider name is treated as `console`.

## When a message is actually sent

Delivery is off unless `EMAIL_DELIVERY_ENABLED=true` or `FEATURE_EMAIL=true`.

| Environment | SMTP host | Sender | Result |
|-------------|-----------|--------|--------|
| Not production | `localhost` or `127.0.0.1` | Any configured `EMAIL_FROM` | Sent to that local catch-all (Mailpit) |
| Not production | Any other host | Any | Logged, not sent |
| Production | Not local | Confirmed `EMAIL_FROM` | Sent |
| Production | Local, empty, or `noreply@localhost` / `@example.com` | — | Logged, not sent |

`EMAIL_REDIRECT_TO`, when set, replaces To, Cc, and Bcc before the provider runs. The original recipients are written to the log. Use this so a staging server cannot email a real organization.

Transient SMTP failures (connection timeouts and 4xx responses) are retried up to `EMAIL_MAX_ATTEMPTS` (default 3) with `EMAIL_RETRY_DELAY_MS` between attempts. Validation errors, authentication failures, and the unconnected transactional provider are not retried. Failures are logged without SMTP passwords.

## Sender and message shape

| Variable | Role |
|----------|------|
| `EMAIL_FROM` | Sender address |
| `EMAIL_FROM_NAME` | Display name |
| `EMAIL_REPLY_TO` | Reply-To header |
| `EMAIL_REDIRECT_TO` | Optional recipient override |

Each message supplies recipients, subject, a text body, an HTML body, or both, and optional attachments. Attachments are limited to 10 files and 10 MB each. Do not attach restricted research documents.

## Local development

Leave the defaults:

```
EMAIL_PROVIDER=console
EMAIL_DELIVERY_ENABLED=false
```

Outgoing mail, including EWI request templates, appears in the API log and is not delivered.

Optional local inbox:

```
docker compose --profile mail up -d mailpit
```

Then set `EMAIL_DELIVERY_ENABLED=true`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, and `SMTP_PORT=1025`. Open Mailpit at `http://localhost:8025`. This still does not contact an external mail host.

## Production

Put credentials in the host environment or a secrets manager. Do not commit them.

```
EMAIL_PROVIDER=smtp
EMAIL_DELIVERY_ENABLED=true
EMAIL_FROM=records@your-domain.example
EMAIL_FROM_NAME=Records
EMAIL_REPLY_TO=records@your-domain.example
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

`SMTP_SECURE=true` is for implicit TLS, usually port 465. Port 587 normally uses `SMTP_SECURE=false` and STARTTLS.

A transactional vendor is not wired. When the client confirms the vendor, domain, and sender, add an adapter that implements `IEmailProvider` and select it from `EmailProviderFactory`. EWI correspondence code stays the same.

`EMAIL_PROVIDER=transactional` with delivery enabled currently fails the send on purpose.

## EWI request templates

Templates live in `apps/api/src/modules/ewi/correspondence` and use the same `{{variable}}` placeholders as prompt templates.

| Template | Use |
|----------|-----|
| `ewi/foia-request` | Public-records request |
| `ewi/university-record-request` | Education or university records |
| `ewi/graduation-verification` | Degree verification |
| `ewi/research-request` | Other client-approved research request |

`EwiCorrespondenceService.compose` builds the message. `deliver` sends it through the shared email service. The investigation job does not call either method, so starting an investigation does not email a university, agency, or other organization.
