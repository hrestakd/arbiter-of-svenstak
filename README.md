# arbiter-of-svenstak

Self-hosted event page — replacement for Facebook Events.

A Vue 3 SPA on Vercel with a name-based gate, event details, meal poll, and live activity feed. Organizers can sign in with GitHub OAuth to create and edit events.

## Stack

- **Frontend:** Vue 3 + Vite + TypeScript + Pinia + vue-router + TailwindCSS
- **API:** Vercel Functions (Node 22)
- **DB:** Neon Postgres (via Vercel Marketplace)
- **KV / sessions / rate limits:** Upstash Redis (via Vercel Marketplace)
- **Image storage:** Vercel Blob
- **Realtime:** Pusher Channels (server triggers from API, client subscribes per event)
- **Auth:** Manual GitHub OAuth (admin) + signed HttpOnly cookie (attendee)

## Quick start

See [`SETUP.md`](./SETUP.md) for the full provisioning checklist.

```bash
npm install
vercel link
vercel env pull .env.local
npm run migrate
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server at http://localhost:5173
- `npm run build` — typecheck + production build to `dist/`
- `npm run typecheck` — vue-tsc only
- `npm run migrate` — apply pending SQL migrations against `$DATABASE_URL`
