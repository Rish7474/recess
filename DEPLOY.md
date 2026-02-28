# Deployment Guide — Recess

This document covers everything needed to go from a fresh clone to a fully functional production website.

## Prerequisites

- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- A [Railway](https://railway.app) account (free tier works)
- A [Google Cloud Console](https://console.cloud.google.com) project (for Google OAuth)
- A [Discord Developer](https://discord.com/developers/applications) application (for Discord OAuth)

---

## 1. Supabase Setup

### 1a. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**
2. Pick a name (e.g. `recess`), set a database password, choose a region close to your users
3. Wait for the project to finish provisioning

### 1b. Grab your API keys

Go to **Settings > API** in the Supabase dashboard. You need three values:

| Value | Where it goes |
|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` (client) and `SUPABASE_URL` (server) |
| **anon (public) key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client) |
| **service_role (secret) key** | `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser) |

### 1c. Run the database migration

1. Go to **SQL Editor** in the Supabase dashboard
2. Click **New Query**
3. Paste the entire contents of `server/db/001_users.sql`
4. Click **Run**

This creates the `public.users` table, enables Row Level Security, and sets up a trigger that auto-populates user records on signup.

### 1d. Configure OAuth providers

#### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Set application type to **Web application**
6. Add **Authorized redirect URIs**:
   - `https://xxxx.supabase.co/auth/v1/callback` (replace `xxxx` with your Supabase project ref)
7. Copy the **Client ID** and **Client Secret**
8. In Supabase dashboard, go to **Authentication > Providers > Google**
9. Toggle it on and paste the Client ID and Client Secret
10. You also need to configure the **OAuth consent screen** in Google Cloud Console (set to External, add your email as a test user during development)

#### Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name
3. Go to **OAuth2** in the sidebar
4. Copy the **Client ID** and **Client Secret**
5. Add a redirect: `https://xxxx.supabase.co/auth/v1/callback`
6. In Supabase dashboard, go to **Authentication > Providers > Discord**
7. Toggle it on and paste the Client ID and Client Secret

### 1e. Set the site URL and redirect URLs

In Supabase dashboard, go to **Authentication > URL Configuration**:

| Field | Development value | Production value |
|---|---|---|
| **Site URL** | `http://localhost:3000` | `https://recess.vercel.app` |
| **Redirect URLs** | `http://localhost:3000/auth/callback` | `https://recess.vercel.app/auth/callback` |

Add both the development and production URLs to the redirect allowlist.

---

### 1f. Run additional database migrations

After the initial `001_users.sql`, run the following SQL files in order in the Supabase SQL Editor:

1. **`server/db/002_drops_scores.sql`** — Creates the `drops` and `scores` tables
2. **`server/db/002b_alter_drops.sql`** — Adds `duration` column and removes legacy columns (run this if you already ran `002` before it was updated)
3. **`server/db/003_game_bank.sql`** — Creates the `game_bank` table for pre-configured games

---

## 2. Local Development

### 2a. Install dependencies

From the repo root:

```bash
npm install
```

This installs dependencies for the root, `client/`, and `server/` workspaces.

### 2b. Create environment files

**`client/.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

**`server/.env`**

```
PORT=4000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CLIENT_URL=http://localhost:3000
ADMIN_SECRET=your-secret-here
```

### 2c. Start both services

```bash
npm run dev
```

This uses `concurrently` to start:
- Next.js frontend on `http://localhost:3000`
- Express backend on `http://localhost:4000`

Or start them individually:

```bash
npm run dev:client   # just the frontend
npm run dev:server   # just the backend
```

### 2d. Verify it works

1. Open `http://localhost:3000` — you should see the dark lobby with a countdown timer
2. Click **Google** or **Discord** to log in
3. After OAuth, you should be redirected back and see your name + avatar
4. Refresh the page — session should persist
5. Visit `http://localhost:4000/health` — should return `{"status":"ok",...}`
6. Check Supabase dashboard **Table Editor > users** — your row should exist

---

## 3. Deploy the Frontend (Vercel)

### 3a. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Phase 1"
git remote add origin https://github.com/your-username/recess.git
git push -u origin main
```

### 3b. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set the **Root Directory** to `client`
4. Framework preset should auto-detect **Next.js**
5. Add environment variables:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `NEXT_PUBLIC_SERVER_URL` | `https://recess-production.up.railway.app` (your Railway URL) |

6. Click **Deploy**

### 3c. After deployment

1. Copy your Vercel deployment URL (e.g. `https://recess.vercel.app`)
2. Go back to Supabase **Authentication > URL Configuration**
3. Update **Site URL** to your Vercel URL
4. Add `https://recess.vercel.app/auth/callback` to the redirect allowlist
5. If you want a custom domain, configure it in Vercel under **Settings > Domains**

---

## 4. Deploy the Backend (Railway)

### 4a. Connect to Railway

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Select your repository
4. Railway will detect the monorepo. Set the **Root Directory** to `server`

### 4b. Configure build and start commands

In Railway's service settings:

| Setting | Value |
|---|---|
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | `server/**` |

### 4c. Add environment variables

In Railway's **Variables** tab:

| Key | Value |
|---|---|
| `PORT` | `4000` (Railway may auto-assign `PORT` — if so, the server reads it from env) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `CLIENT_URL` | `https://recess.vercel.app` (your Vercel URL, for CORS) |
| `ADMIN_SECRET` | A random secret string for admin endpoints (e.g. `openssl rand -hex 32`) |

### 4d. Verify

After Railway deploys, it gives you a public URL (e.g. `https://recess-production.up.railway.app`).

Test it:
```bash
curl https://recess-production.up.railway.app/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 4e. Update the frontend to use the production backend

If future phases add client-to-server API calls or Socket.io, you will need a `NEXT_PUBLIC_SERVER_URL` environment variable on Vercel pointing to your Railway URL. For Phase 1, the frontend talks only to Supabase directly, so this is not yet needed.

---

## 5. Post-Deployment Checklist

| Check | How to verify |
|---|---|
| Frontend loads | Visit your Vercel URL, see the dark lobby with countdown |
| Google login works | Click Google button, complete OAuth, redirected back with name shown |
| Discord login works | Click Discord button, complete OAuth, redirected back with name shown |
| Session persists | Refresh the page after login — still logged in |
| User row created | Check Supabase Table Editor > `public.users` — row exists |
| Backend health check | `curl https://your-railway-url/health` returns 200 |
| CORS works | Browser console shows no CORS errors when frontend calls backend |

---

## 6. Environment Variable Reference

### client/.env.local (and Vercel env vars)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `NEXT_PUBLIC_SERVER_URL` | Yes | Express backend URL (e.g. `http://localhost:4000` or Railway URL) |

### server/.env (and Railway env vars)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port the Express server listens on (default: 4000) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (secret, server-only) |
| `CLIENT_URL` | Yes | Frontend URL for CORS allowlisting |
| `ADMIN_SECRET` | Recommended | Secret for admin endpoints (test-game). If unset, admin routes return 403 |

---

## 7. Custom Domain (Optional)

### Vercel
1. Go to your project in Vercel > **Settings > Domains**
2. Add your domain (e.g. `recess.com`)
3. Update DNS records as instructed by Vercel (usually a CNAME to `cname.vercel-dns.com`)
4. Update Supabase **Site URL** and **Redirect URLs** to use the custom domain

### Railway
1. Go to your service in Railway > **Settings > Networking > Public Networking**
2. Add a custom domain
3. Update DNS as instructed
4. Update `CLIENT_URL` env var on Railway if you changed the frontend domain

---

## 8. Seeding the Game Bank

The game bank stores pre-configured games that the daily cron job picks from. To seed it for first use:

### Option A: Use the seed script

```bash
cd server
npx tsx scripts/seed-games.ts
```

This inserts several sample Agar.io game configurations into the `game_bank` table.

### Option B: Add games via the API

```bash
curl -X POST https://your-railway-url/api/game-bank \
  -H "Content-Type: application/json" \
  -d '{
    "engine": "agario",
    "title": "Neon Sprawl",
    "lore": "The grid pulses with energy...",
    "params": { "world_size": 5000, "food_count": 400, "base_speed": 3 },
    "theme": { "background": "#111118", "accent": "#ff3366", "grid": "#1a1a24" },
    "duration": 300
  }'
```

Each day at 6:00 PM EST, the cron job picks the next unused game from the bank and starts it automatically.

---

## 9. Application Routes

| Route | Description |
|---|---|
| `/` | Main lobby — countdown timer, tonight's drop info, yesterday's leaderboard |
| `/profile` | User profile — game history calendar, stats, badges (requires sign-in) |
| `/auth/callback` | OAuth redirect handler (internal) |

---

## 10. Triggering a Test Game

To manually trigger a test game (for development or verification):

```bash
curl -X POST https://your-railway-url/api/admin/test-game \
  -H "x-admin-secret: your-admin-secret-here"
```

This starts a 60-second Agar.io game. All connected clients will see the game start immediately.

---

## 11. Troubleshooting

### "Your project's URL and Key are required to create a Supabase client!"
Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Make sure they are set in `client/.env.local` (local) or Vercel env vars (production). Restart the dev server after adding them.

### OAuth redirects to wrong URL
Check Supabase **Authentication > URL Configuration**. The **Site URL** must match where you are running (localhost for dev, Vercel URL for prod). The auth callback URL (`/auth/callback`) must be in the redirect allowlist.

### Google OAuth says "redirect_uri_mismatch"
The redirect URI in Google Cloud Console must be exactly `https://xxxx.supabase.co/auth/v1/callback`. Double-check there are no trailing slashes or typos.

### CORS errors in browser console
The `CLIENT_URL` env var on the server must match the exact origin of the frontend (including `https://`, no trailing slash). Example: `https://recess.vercel.app`.

### Railway deploy fails with "Cannot find module"
Make sure the **Root Directory** in Railway is set to `server`, and the build command runs `npm install && npm run build` (which compiles TypeScript to `dist/`).

### User logs in but name/avatar doesn't show
Check that the `public.users` trigger was created by running `server/db/001_users.sql`. Look in Supabase **Table Editor > users** to see if the row was inserted. If the table exists but is empty, the trigger may not have been created — re-run the SQL.
