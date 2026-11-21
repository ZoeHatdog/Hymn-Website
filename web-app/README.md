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

This is a Vite + React desk. `/api` is proxied to the hymn API (`API_BASE_URL`, default `http://localhost:3000`). Start that API separately. This app does not change the API.

| Path | Purpose |
|------|---------|
| `/` | Landing page |
| `/view` | Choose a hymn to read |
| `/view/:id` | Read one hymn |
| `/add` | Add a hymn |
| `/update` | Choose a hymn to update |
| `/update/:id` | Correct one hymn |
| `/delete` | Delete a hymn |
| `/api/*` | Proxied to the hymn API |
