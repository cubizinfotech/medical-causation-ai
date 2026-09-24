# Authentication

Login and roles live in the shared platform layer (`apps/api/src/platform/auth` and `apps/api/src/platform/users`). MCA and EWI use the same accounts. Product modules do not keep a separate user table.

Authentication is off unless `AUTH_ENABLED=true`. With the flag off, MCA and EWI pages stay open and those APIs do not require a token. Health, `GET /auth/status`, and `POST /auth/login` stay public either way.

When the flag is on:

- The API rejects calls to MCA and EWI routes without a bearer token.
- The same check applies to the `/medical-analysis` and `/ewi` socket connections.
- The Next.js app redirects `/mca` and `/ewi` to `/login`. That redirect is a convenience. The API is the authorization boundary.
- Startup fails if `JWT_SECRET` is empty.

`GET /auth/me` and `GET /auth/users` require a token even when product routes are open. Only Super Admin and Admin can list users.

## Roles

| Role | Local demo email | Access when auth is on |
|------|------------------|-------------------------|
| Super Admin | super-admin@example.com | MCA, EWI, and the user list |
| Admin | admin@example.com | MCA, EWI, and the user list |
| Attorney | attorney@example.com | MCA and EWI |
| Paralegal | paralegal@example.com | MCA and EWI |
| Medical Expert | medical-expert@example.com | MCA and EWI |
| User | normal-user@example.com | MCA and EWI |

There is no law-firm tenancy yet. Every signed-in role above can open both products. Listing users is the extra admin permission.

## Local demo accounts

Create them from the repository root:

```bash
npm run seed:demo-users
```

The command upserts the six users and hashes the password. Running it again does not duplicate rows. It refuses to run when `NODE_ENV=production`.

Each local account uses the password `password`. That value is for local demonstration only. Do not use these accounts in production, and do not put the password in environment files.

Sign in at `http://localhost:3000/login` after `AUTH_ENABLED=true` and a local `JWT_SECRET` are set and the API has been restarted. The header shows the role.

## Production

Set `AUTH_ENABLED=true` and a long random `JWT_SECRET` in the server environment before the site is reachable on the internet. Create real users separately. Do not run the demo seed on the production server.

Passwords are stored only as a bcrypt hash. The token carries the user id, email, and roles.

## Related

- [demo-guide.md](./demo-guide.md)
- [security.md](./security.md)
- [digitalocean.md](./digitalocean.md)
