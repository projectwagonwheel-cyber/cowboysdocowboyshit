# cowboysdocowboyshit.com

UGC ranking site. People upload cowboy shit. Strangers swipe to rank how cowboy
it is. Daily / weekly / all-time leaderboards crown winners.

The product plan lives at `.plans/ugc-platform.md`. Read it before changing
the shape of the app.

## Stack

- Frontend: vanilla HTML + CSS + JS, no build step, no framework.
- Backend: Cloudflare Pages Functions (TypeScript) + Hono router.
- Database: Cloudflare D1 (SQLite at the edge).
- Photo storage: Cloudflare R2.
- Video pipeline: Cloudflare Stream (handles transcoding, player, posters).
- Admin gate: Cloudflare Access policy in front of `/admin` and `/api/admin/*`.
- Auto-deploy: GitHub Actions → `wrangler pages deploy` on push to `main`.

## Repo & hosting

- GitHub: https://github.com/projectwagonwheel-cyber/cowboysdocowboyshit
- Hosting: Cloudflare Pages
- DNS: Cloudflare
- Domain: cowboysdocowboyshit.com

## Local dev

```sh
npm install
npm run db:migrate:local      # apply migrations to local D1
npm run dev                    # wrangler pages dev
```

The dev server runs at http://localhost:8788 with a local D1 + a local R2
emulator. Stream calls hit production (there's no local emulator), so video
upload won't work locally without `CF_STREAM_API_TOKEN` in `.dev.vars`.

## File layout

```
index.html                Homepage (cinematic landing + winner pin + CTAs)
styles.css                All styling, both registers (cinematic + utility)
app.js                    Shared client glue (share button)
favicon.svg               Minimal longhorn mark
404.html                  404
vote/                     Swipe-rank UI
submit/                   Upload form (photo or video, two-step for video)
submit/thanks/            Post-submit "in the queue" page
leaderboard/              Today / week / all-time
admin/                    Moderation queue (gated by Cloudflare Access)
about/, terms/, privacy/, dmca/, report/   Static text pages
functions/                Pages Functions (Workers)
  api/[[path]].ts         All API routes (Hono router)
  c/[slug].ts             Server-rendered permalink (with OG meta)
  og/[slug].ts            OG image redirect (phase 1: just the photo)
  _lib/                   Shared utilities (db, hash, elo, slug, auth, stream)
migrations/               D1 SQL migrations
wrangler.toml             Bindings + vars
.github/workflows/        CI deploy
.plans/                   Implementation plan (read this!)
assets/                   Founder's source media (NOT served on prod)
```

## Conventions

- Small commits, verbose messages.
- No frameworks on the frontend. No React. No SPA. If you need to add a
  build step, ask first.
- TypeScript inside `functions/`. Plain HTML/CSS/JS at the surface.
- Server-side: trust Cloudflare's edge for rate limiting and bandwidth;
  don't reinvent it.
- Two visual registers: cinematic for marketing surfaces (home, leaderboard,
  permalink), utilitarian for the voting/submit/admin surfaces. Don't mix.
- Comments only when the WHY is non-obvious.
- Don't ship NSFW classifier, accounts, comments, categories, or merch
  without checking the plan — those are explicitly phase 2/3.

## Routing

Pages serves static HTML by default. Three routes are functions:
- `/api/*` → `functions/api/[[path]].ts` (Hono catch-all)
- `/c/:slug` → server-rendered permalink with OG tags
- `/og/:slug` → OG image (phase 1: redirects to the photo URL)

`_routes.json` whitelists those — everything else falls through to static.

## Bindings

- `DB` — D1 database (`cowboyshit`)
- `MEDIA` — R2 bucket (`cowboyshit-media`)
- Vars: `MEDIA_PUBLIC_URL` (custom domain pointing at the R2 bucket)
- Secrets: `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, `ADMIN_EMAIL`,
  `KILL_SWITCH_TOKEN`

## Admin

`/admin` is protected by a Cloudflare Access policy (configured in the
dashboard, not in code). Inside the function, `isAdmin()` checks the
`Cf-Access-Authenticated-User-Email` header against `ADMIN_EMAIL`.

## Kill switch

If something illegal lands publicly:
```sh
curl -X POST https://cowboysdocowboyshit.com/api/kill-switch \
  -H "Authorization: Bearer $KILL_SWITCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paused": true}'
```
The vote feed and vote endpoint return 503 until you flip it back.

## Status (last session: 2026-05-06)

- Phase 1 scaffold complete: schema, all API routes, all UI pages, deploy
  workflow. Everything wired locally; remote deploy needs Cloudflare
  resources enabled (see `DEPLOY.md`).
- Open hand-off items (require user's hands, not Claude's): create the D1
  database, R2 bucket, custom domain for media bucket, Cloudflare Access
  policy on `/admin*`, GitHub Actions secrets, set Pages secrets.
