# Hymn web app

Vite + React maintenance desk for the hymn library. It lists hymns from the existing API and routes to view, add, update, and delete.

## Run

From `web-app`:

```bash
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:3001

This is a Vite + React desk. `/api` is proxied to the hymn API (`API_BASE_URL`, default `http://localhost:3000`). Start that API separately.

Sign-in is email-only. The desk emails a 6-digit code through Gmail, or the keeper can continue with Google. Reading hymns stays open. Adding, updating, deleting, and uploading a sheet require a signed-in session.

Put these in `web-app/.env` before signing in:

| Name | Purpose |
|------|---------|
| `AUTH_SECRET` | Signs the session cookie. At least 16 characters. |
| `AUTH_ALLOWED_EMAILS` | Optional. Comma-separated emails allowed to sign in. |
| `GOOGLE_CLIENT_ID` | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3001/api/auth/google/callback` |
| `GMAIL_USER` | Gmail address that sends the code. |
| `GMAIL_APP_PASSWORD` | Google app password for that mailbox. |
| `GMAIL_FROM` | Optional From address. Defaults to `GMAIL_USER`. |

In Google Cloud, create an OAuth client (Web application) and add that redirect URI. The Gmail account needs 2-Step Verification, then an app password.

## Paths

| Path | Purpose |
|------|---------|
| `/login` | Sign in with a code or Google |
| `/` | Landing page |
| `/view` | Choose a hymn to read |
| `/view/:id` | Read one hymn |
| `/add` | Add a hymn |
| `/update` | Choose a hymn to update |
| `/update/:id` | Correct one hymn |
| `/delete` | Delete a hymn |
| `/api/*` | Proxied to the hymn API |
