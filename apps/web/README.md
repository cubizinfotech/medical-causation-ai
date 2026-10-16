# Web

Next.js website for Medical Causation Analysis (MCA) and Expert Witness Investigation (EWI). Run it from the repository root with `npm run dev:web`; setup is in the root [README.md](../../README.md).

## Layout

| Folder | What lives there |
|--------|------------------|
| `src/app/` | Pages: `/` home, `/login`, `/profile`, `/mca/*` (case, analysis, histories, report, demand letter), `/ewi/*` (intake, investigation, histories), `/terms`, `/privacy` |
| `src/components/` | `mca/`, `ewi/`, `profile/`, `layout/` (header, user menu), `ui/` (buttons, inputs, dialogs) |
| `src/features/` | API clients, form schemas, job hooks, browser storage; `auth/` holds the session |
| `src/lib/config/` | API address (`api-url.ts`) and `apiFetch`, the one function that talks to the API |
| `src/utils/` | `cn` (class names) and date formatting |

## How it talks to the API

- Every request goes through `apiFetch` in `src/lib/config/api.ts`, which adds the sign-in token. If the API answers 401 (session expired or signed out elsewhere), the token is dropped and the user is sent to the login page.
- The API address comes from `NEXT_PUBLIC_API_URL`, which is built into the site by `npm run build`. Rebuild after changing it.
- Job progress arrives over Socket.IO (`src/lib/config/socket.ts`), with polling as a fallback.

## Session rules

- `/mca`, `/ewi`, and `/profile` need a signed-in user (`AuthGate` in `features/auth/auth-session.tsx`).
- After sign-in the user returns to the page they asked for, but only to a path on this site (`features/auth/safe-next-path.ts`).
- Sign-in and sign-out clear everything the browser kept for the previous user: the token, case drafts and results in `sessionStorage`, saved letterhead details, and the query cache.

## Security headers

`next.config.ts` sends a Content-Security-Policy that blocks framing, plugins, and `<base>` tags, plus `X-Frame-Options`, `nosniff`, a referrer policy, and a permissions policy on every page.

## Checks

```bash
npm test --workspace=web
npm run lint --workspace=web
npm run typecheck --workspace=web
```
