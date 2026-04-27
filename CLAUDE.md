# CLAUDE.md

Project-specific context for Claude Code. Read this before touching the codebase.

## Project

Arbiter of Svenstak — Vue 3 SPA replacement for Facebook Events. One yearly birthday event (15-year tradition), two organizers (Domagoj/`hrestakd` + Sven/`SvenKolaric`), ~50–200 friend attendees per year.

Production: https://arbiter-of-svenstak.vercel.app

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Pinia + vue-router + TailwindCSS |
| API | Vercel Functions (Node 22), `api/**/*.ts` |
| DB | **Neon** Postgres via Vercel Marketplace (`@neondatabase/serverless` `Pool`) |
| KV | **Upstash** Redis via Vercel Marketplace (`@upstash/redis`) |
| Files | Vercel Blob (`@vercel/blob`), public access |
| Realtime | Pusher Channels, channel `event-{id}` |
| Admin auth | Manual GitHub OAuth → signed cookie + KV-backed session |
| Attendee auth | HMAC-signed cookie bound to (attendee_id, session_token) |
| Theme | Pixel-anime (Press Start 2P + VT323 + Pixelify Sans), two themes: `classic` light pastel, `neon` dark CRT |

## Function budget

**12 of 12 Vercel Hobby cap used.** Adding routes requires consolidating existing files (e.g. merging `posts/[id]/reactions.ts` + `posts/[id]/comments.ts`) or upgrading to Pro. Files in `api/_lib/` (underscore prefix) don't count.

## Gotchas (read these — they cost real time to discover)

### Vercel routing
- **Catch-all params include the dots in the key.** `[...rest].ts` exposes the value at `req.query['...rest']`, NOT `req.query.rest`. Always read the bracketed key.
- **Catch-all delivers nested paths as a slash-joined string**, not an array. Split on `/`: `raw.split('/').filter(Boolean)`.
- **Catch-all is unreliable for 2+ segment paths.** A `[...rest].ts` will match `/foo` but may 404 for `/foo/bar` (HTML 404 from Vercel's edge — causes `JSON.parse` failures client-side). Use explicit files for deeper paths. Example: `api/events/[id]/attendees/me.ts` exists separately because the parent catch-all wouldn't reliably match `attendees/me`.
- **Optional catch-all `[[...rest]].ts` is broken** for the parent-empty case in standalone Vercel functions. Use a sibling `index.ts` + required `[...rest].ts` instead.
- **`vercel.json` rewrites apply to `vercel dev` too.** SPA-fallback rewrites must explicitly exclude Vite's dev paths (`@vite/`, `@id/`, `@fs/`, `src/`, `node_modules/`) AND any path containing a `.` (so `/favicon.ico` etc. aren't rewritten to index.html).
- **Don't use `runtime: "nodejs22.x"` in vercel.json** — that's AWS Lambda's format. Vercel auto-detects from file extension; only specify if you really need a builder package like `@vercel/node@5.0.0`.

### Cookies
- **`res.setHeader('Set-Cookie', ...)` followed by `res.redirect()` loses the cookie.** Vercel's runtime can overwrite Set-Cookie between calls. Use `res.writeHead(302, {'Set-Cookie': header, Location: url})` + `res.end()` for atomic delivery. Same pattern for status + JSON + Set-Cookie:
  ```ts
  res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': header });
  res.end(JSON.stringify(body));
  ```
- **HttpOnly cookies are invisible to JS.** Client can't tell if a session is valid by reading cookies — must hit a server endpoint. Use `/api/auth/me` to populate `session.attendee` + `session.admin` on app boot.

### ESM
- **All relative imports inside `api/` must use `.js` extensions** (`from '../_lib/db.js'`), even though source is `.ts`. Vercel deploys raw ESM and Node's loader requires explicit extensions. Vite/tsx are forgiving in dev so this only breaks in production.

### Async pitfalls
- **`session.probe()` uses an in-flight promise** (module-level `probeInFlight`) so concurrent callers (App.vue's onMounted + router beforeEach) await the same fetch. Don't regress to `if (probing) return;` — the second caller would get an instantly-resolved void and proceed before `admin.value` is populated, causing `/admin → /` bouncing.

### DB / migrations
- **`@neondatabase/serverless`'s tagged-template `sql` only handles single statements.** Use `Pool` with `client.query()` for multi-statement SQL files (see `scripts/migrate.ts`).
- **`neonConfig.fetchConnectionCache = true`** is deprecated (now always true). Don't set it.
- **`tsx` doesn't auto-load `.env.local`.** `scripts/migrate.ts` calls `process.loadEnvFile('.env.local')` itself.

### Vercel Marketplace deprecations (2026 baseline)
- **Vercel Postgres** is no longer offered as a first-class product — provision Neon via Marketplace.
- **Vercel KV** is no longer offered — use Upstash Redis via Marketplace. Env vars come as either `KV_REST_API_*` (legacy branding) or `UPSTASH_REDIS_REST_*` (newer integration). `api/_lib/kv.ts` reads either.

### Pusher / realtime
- **Vercel can't host websockets.** Pusher is the multiplexer; API routes write to Postgres then `pusher.trigger()` to fan out. Swap is localized to `api/_lib/pusher.ts` + `src/composables/useRealtime.ts` if we ever migrate to self-hosted `pg_notify`.
- **`VITE_PUSHER_KEY` + `VITE_PUSHER_CLUSTER` must be set in Vercel build env**, not just function env. Vite reads these at build time, not runtime.

## Conventions

- **Logging:** every endpoint emits `[scope]` tagged console logs (e.g. `[auth/me]`, `[events/attendees/me]`). When debugging, ask for the log line first instead of guessing.
- **Public reads, gated writes:** GET endpoints (attendees list, posts feed, poll counts, comments) are public. Only POST/PATCH require an attendee session. Guests bypass the gate via `localStorage.guest_mode = "1"` for read-only viewing.
- **Themes** are CSS variables on `<body data-theme="...">`. Two values: `classic`, `neon`. Set per-event in admin form; SPA flips it via `eventStore.setEvent`.
- **Admin landing is a tile menu** at `/admin`. Event list lives at `/admin/events`. Don't redirect `/admin` to the list directly.

## Dev workflow

```bash
npm run dev          # vite only, port 5173 — fast UI iteration, no API
vercel dev           # vite + API functions emulated, slower but full stack
vercel env pull .env.local
npm run migrate      # apply pending SQL migrations against $DATABASE_URL
npm run build        # vue-tsc + vite build
```

## Files to know

| File | Purpose |
|---|---|
| `api/_lib/db.ts` | Neon Pool + `query`/`queryOne`/`withTransaction` |
| `api/_lib/session.ts` | Cookie HMAC sign/unpack, `readAdminSession` + `readAttendeeSession` |
| `api/auth/[action].ts` | All four auth actions (`github`, `callback`, `me`, `logout`) in one function |
| `api/events/[id]/[...rest].ts` | Catch-all for `/attendees`, `/posts`, `/poll` (single-segment paths) |
| `api/events/[id]/attendees/me.ts` | Explicit file for the 2-segment `attendees/me` PATCH |
| `src/stores/session.ts` | `attendee` + `admin` + `guestMode`, with `probeInFlight` race fix |
| `src/router.ts` | Guards check `requiresAdmin` (admin only) and `requiresAttendee` (attendee OR guest) |
| `src/views/EventView.vue` | Three modes: attendee (write), guest (read-only banner), archive (read-only no realtime) |
| `migrations/0001_init.sql` | Initial schema |
| `migrations/0002_add_location_map_url.sql` | Adds Google Maps embed URL field |
| `vercel.json` | `framework: "vite"`, dev/build commands, careful SPA-fallback rewrite |
| `SETUP.md` | Provisioning checklist (run once per fresh clone) |
