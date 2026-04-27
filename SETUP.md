# SETUP

End-to-end checklist to take this repo from clone to live URL. Two organizers (Domagoj + Sven) — both can sign in via GitHub OAuth once their usernames are seeded.

## 1. Install local toolchain

```bash
node --version   # >= 20
npm --version    # >= 10
npm i -g vercel  # optional but recommended
```

## 2. Clone & install

```bash
git clone <repo>
cd arbiter-of-svenstak
npm install
```

## 3. Provision external resources via Vercel

Vercel Postgres and Vercel KV are no longer first-class — both go through the **Vercel Marketplace**.

1. Create the Vercel project:
   ```bash
   vercel link
   ```
2. In the Vercel dashboard → **Storage**:
   - **Add database → Neon (Postgres)** — gives you `DATABASE_URL`.
   - **Add database → Upstash Redis** — gives you `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
   - **Add Blob store** — gives you `BLOB_READ_WRITE_TOKEN`.
3. Pull the env vars locally:
   ```bash
   vercel env pull .env.local
   ```

## 4. Pusher Channels

1. Sign up at https://pusher.com/channels (free tier).
2. Create an app. Note: **App ID, Key, Secret, Cluster** (e.g. `eu`).
3. Add these to Vercel project env (Production + Preview + Development):
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` (server-side)
   - `VITE_PUSHER_KEY`, `VITE_PUSHER_CLUSTER` (exposed to the SPA)
4. Re-run `vercel env pull .env.local`.

## 5. GitHub OAuth app

1. https://github.com/settings/developers → **New OAuth App**.
2. **Homepage URL:** your Vercel deployment URL (e.g. `https://arbiter-of-svenstak.vercel.app`).
3. **Authorization callback URL:** `https://<your-vercel-url>/api/auth/callback`.
   - For local dev: `http://localhost:5173/api/auth/callback` — register a second OAuth app for local, or temporarily change the production app's callback.
4. Copy **Client ID** and **Client Secret** into Vercel env:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_OAUTH_REDIRECT_URI` = `https://<your-vercel-url>/api/auth/callback`
5. Re-run `vercel env pull .env.local`.

## 6. Generate session secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add as `SESSION_SECRET` in Vercel env (and `.env.local`).

## 7. Seed the admins table

Edit `migrations/0001_init.sql` lines around the `INSERT INTO admins` block. Replace:

```sql
INSERT INTO admins (github_username) VALUES
  ('domagoj-github'),  -- TODO Domagoj: replace with your actual GH login
  ('sven-github');     -- TODO Sven:    replace with actual GH login
```

with the real GitHub login names. (Don't quote-format your @-prefixed display name; use the URL slug, e.g. `octocat` from `github.com/octocat`.)

## 8. Run migrations

```bash
npm run migrate
```

You should see:

```
apply  0001_init.sql
Applied 1 migration(s).
```

If you re-run it: `skip 0001_init.sql (already applied)`.

## 9. Personalize default payment tags (optional)

The migration seeds `events.payment_tags` with placeholder Revolut + KeksPay handles for both organizers. Once you've created your first event in the admin form, edit the values directly in that form. Future-year events created from the admin will inherit the same defaults — adjust the migration's `payment_tags` JSON literal if you want different defaults.

## 10. Local dev smoke-test

```bash
npm run dev
```

Visit http://localhost:5173 — you should see the gate page (with the warning that no event is published yet, until you create one).

## 11. Deploy

```bash
vercel deploy --prod
```

## 12. First-event walk-through

1. Sign in: `https://<your-url>/admin/login` → Sign in with GitHub.
2. Click **+ New event**, fill in title / date / location / description / theme, upload a header image, mark **current**, save.
3. Open `https://<your-url>/` in a private window, fill the gate form, submit. You should see the payment tags page, click continue, see the full event view.
4. Open a second private window, submit a different name. Check that both attendees appear in the live attendee list **without refresh** (Pusher is working).
5. Post in the feed, like/dislike, comment, vote in the meal poll — verify each updates live across both tabs.

## Environment variable quick reference

| Variable | Where it comes from | Used by |
|---|---|---|
| `DATABASE_URL` | Vercel Marketplace → Neon | API + migrations |
| `KV_REST_API_URL` | Vercel Marketplace → Upstash | API |
| `KV_REST_API_TOKEN` | Vercel Marketplace → Upstash | API |
| `BLOB_READ_WRITE_TOKEN` | Vercel Marketplace → Blob | Admin upload |
| `PUSHER_APP_ID` / `_KEY` / `_SECRET` / `_CLUSTER` | Pusher dashboard | API (server) |
| `VITE_PUSHER_KEY` / `VITE_PUSHER_CLUSTER` | Pusher dashboard | SPA (client) |
| `GITHUB_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | GitHub OAuth app | API (auth flow) |
| `SESSION_SECRET` | `crypto.randomBytes(32).toString('base64')` | API (cookie signing) |
| `APP_PUBLIC_URL` | Your domain | (reserved for future use) |

## Troubleshooting

- **"DATABASE_URL is not set"** — `vercel env pull .env.local` and re-run.
- **GitHub OAuth says 403 "not on the admin allowlist"** — your migration seeds didn't include the right GH username. Re-edit the migration, drop/recreate the row, or just `INSERT INTO admins (github_username) VALUES ('your-actual-login')` directly.
- **Realtime doesn't update** — open browser console, look for `Pusher` errors. Most common: forgot to set `VITE_PUSHER_KEY`/`VITE_PUSHER_CLUSTER` (these need to be in the build env, not just the function env).
- **Blob upload 403** — `BLOB_READ_WRITE_TOKEN` missing in the function env.
