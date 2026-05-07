# Deploy hand-off — phase 1

Everything is built locally. The steps below are the ones that need *your*
hands (Cloudflare dashboard, billing, Access policy). After they're done,
push to `main` and GitHub Actions takes it from there.

## 0. Local sanity check (optional but recommended)

```sh
cd ~/code/cowboysdocowboyshit
npm install
npm run db:migrate:local
npm run dev
```

Open http://localhost:8788. Submit a test photo, hit `/admin` (won't be
gated locally — that's fine), approve it, vote on it, see it on the
leaderboard. Video uploads need `CF_STREAM_API_TOKEN` in `.dev.vars` to
work locally; skip them if you haven't set up Stream yet.

## 1. Cloudflare account + wrangler login

```sh
npx wrangler login
```

This opens a browser, you authorize wrangler. One time only.

## 2. Create D1 database

```sh
npx wrangler d1 create cowboyshit
```

Copy the `database_id` it prints. Open `wrangler.toml`, replace
`REPLACE_WITH_D1_ID` with it.

Apply migrations to remote:
```sh
npm run db:migrate:remote
```

## 3. Create R2 bucket

```sh
npx wrangler r2 bucket create cowboyshit-media
```

Then in the Cloudflare dashboard:
1. Go to R2 → `cowboyshit-media` → Settings.
2. Public access → "Connect Domain" → enter `media.cowboysdocowboyshit.com`.
3. Cloudflare adds the DNS record for you. Wait a minute for it to provision.
4. Update `MEDIA_PUBLIC_URL` in `wrangler.toml` if you used a different
   subdomain.

## 4. Enable Cloudflare Stream

Dashboard → Stream → enable (paid: ~$5 per 1k minutes stored, $1 per 1k
minutes delivered).

## 5. Create an API token for Stream

Dashboard → My Profile → API Tokens → Create Token → Custom token:
- Permission: `Account` → `Stream` → `Edit`
- Account resources: your account only
- Save the token.

Get your account ID from the Cloudflare dashboard sidebar (right column on
any page). It's a 32-char hex string.

## 6. Create the Pages project

In the Cloudflare dashboard, Pages → Create project → Connect to GitHub →
pick `projectwagonwheel-cyber/cowboysdocowboyshit`. Build settings:
- Framework preset: None
- Build command: (leave blank)
- Build output directory: `/`

This creates the project. The first deploy may fail because secrets aren't
set yet — that's fine, fix it in the next step.

## 7. Set Pages Functions secrets

For each, run:
```sh
npx wrangler pages secret put CF_ACCOUNT_ID --project-name=cowboysdocowboyshit
npx wrangler pages secret put CF_STREAM_API_TOKEN --project-name=cowboysdocowboyshit
npx wrangler pages secret put ADMIN_EMAIL --project-name=cowboysdocowboyshit
npx wrangler pages secret put KILL_SWITCH_TOKEN --project-name=cowboysdocowboyshit
```

Values:
- `CF_ACCOUNT_ID` — from step 5
- `CF_STREAM_API_TOKEN` — from step 5
- `ADMIN_EMAIL` — your email (the one you'll log into Cloudflare Access with)
- `KILL_SWITCH_TOKEN` — generate with `openssl rand -hex 32`. Save this
  somewhere on your phone — you'll need it in an emergency.

## 8. Bind D1 + R2 to the Pages project

Pages dashboard → `cowboysdocowboyshit` → Settings → Functions → Bindings:
- D1 database → variable name `DB`, database `cowboyshit`
- R2 bucket → variable name `MEDIA`, bucket `cowboyshit-media`
- Environment variable → `MEDIA_PUBLIC_URL` = `https://media.cowboysdocowboyshit.com`

## 9. Cloudflare Access policy on /admin

Dashboard → Zero Trust → Access → Applications → Add an application:
- Type: Self-hosted
- Application domain: `cowboysdocowboyshit.com/admin*`
- Add a *second* domain: `cowboysdocowboyshit.com/api/admin/*` (so the API
  is gated too — without this, anyone could hit the admin endpoints)
- Identity provider: One-Time PIN (email)
- Policy: include emails matching `ADMIN_EMAIL`

This means anyone hitting `/admin` is bounced to a Cloudflare-hosted email
PIN flow, and only your email gets through. The `Cf-Access-Authenticated-User-Email`
header is then trusted by the function.

## 10. Custom domain on Pages

Pages → `cowboysdocowboyshit` → Custom domains → add `cowboysdocowboyshit.com`
and `www.cowboysdocowboyshit.com`. Cloudflare wires the DNS automatically
since DNS is also on Cloudflare.

## 11. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:
- `CLOUDFLARE_API_TOKEN` — create one in dashboard with permissions:
  Account → `Cloudflare Pages:Edit`, `D1:Edit`, `Workers Scripts:Edit`
- `CLOUDFLARE_ACCOUNT_ID` — same as above

## 12. First deploy

```sh
git add -A
git commit -m "phase 1 build: UGC ranking platform"
git push origin main
```

GitHub Actions runs the workflow. Watch it in the Actions tab. First run
takes ~2 min. If it succeeds, https://cowboysdocowboyshit.com is live.

## 13. Smoke test in production

1. `/` — homepage, cinematic landing renders, no console errors.
2. `/submit` — upload a test photo. Should land on `/submit/thanks`.
3. `/admin` — Access redirects to email PIN, you log in, queue shows
   your test photo. Approve it.
4. `/vote` — your test photo is the only thing in the feed, vote on it.
5. `/leaderboard` — your test photo appears (after 3+ votes).
6. `/c/<slug>` — permalink renders, OG meta is in the HTML.
7. Kill switch works:
   ```sh
   curl -X POST https://cowboysdocowboyshit.com/api/kill-switch \
     -H "Authorization: Bearer $KILL_SWITCH_TOKEN" \
     -H "Content-Type: application/json" -d '{"paused":true}'
   ```
   `/vote` shows "feed is paused". Flip back with `"paused":false`.

## What's deferred to phase 2 (NOT in this build)

- Optional accounts (OAuth)
- Categories / tags
- Auto-NSFW screening
- Hall of Fame archive page
- Weekly themed prompts
- Generated OG card with score overlay (currently OG image = the photo)
- Daily winner cron job (today the homepage just queries on each load)

## What's missing on the cinematic landing

- The hero references `assets/photo-1.jpg` and `assets/photo-2.jpg` which
  don't exist. The `media-optimizer` agent in `.claude/agents/` was set up
  for this — pick from your raw `assets/` and run it.
- The cow motif: I shipped a placeholder longhorn favicon at
  `/favicon.svg`. Swap it if you have something you'd rather use.
