# cowboysdocowboyshit — UGC platform plan

_Plan date: 2026-05-06. Owner: forbesdever (solo). Repo: `~/code/cowboysdocowboyshit`._

## Vision

cowboysdocowboyshit.com becomes a stupid-fun, viral-shaped UGC site where anyone can submit a piece of "cowboy shit" — a photo or short clip of someone doing something undeniably cowboy — and the internet decides how cowboy it actually is. The core loop is **submit → swipe-rank → leaderboard.** A daily "Most Cowboy" winner crowns at midnight CT. The brand voice is dry, deadpan, cinematic; the product underneath is a low-friction ranking machine. One-sentence pitch: _"Tinder for cowboy shit, with a leaderboard."_

The static landing page is the trailhead — it stays as the marketing front door (or gets folded into the app's hero) and the live product mounts at `cowboysdocowboyshit.com/` (app) or behind a `play.` / no-subdomain route. Audience: rural-coded internet (rodeo TikTok, ranch Twitter, country meme accounts) plus the much larger ironic-urban audience that finds it funny. Both groups submit; both vote.

## Out of scope (v1)

Cutting hard so v1 ships in ~2 weeks:

- **No accounts.** Anonymous submit, anonymous vote. Display name optional, freeform, not unique. (Re-evaluated in phase 2.)
- **No comments.** Comments are a moderation tarpit and add zero to the core loop. Maybe ever, definitely not v1.
- **No DMs, follows, profiles.** Not a social network.
- **No native mobile app.** Mobile web only — it's a swipe interface, the browser is fine.
- **No categories/tags at submit time.** Everything is one feed. Tags come in phase 2 once we see what people actually post.
- **No video editing/trimming in-browser.** Upload it as-is, we transcode server-side, max 30 seconds — anything longer rejects.
- **No multi-image submissions.** One asset per submission. Carousels in phase 3.
- **No paid features, no merch store, no sponsorships.** Build the audience first.
- **No email, no newsletter, no notifications.** Nothing to email about yet.
- **No "edit submission" flow.** Delete and re-submit if you screwed up.
- **No search.** Browse via leaderboard + random swipe.

## Milestones

**Phase 1 — MVP, the core loop is live (target: 10–14 days)**

1. **Infra spike (S)** — Cloudflare R2 bucket, Cloudflare Images binding, Cloudflare Stream account enabled, Workers + D1 set up, custom domain confirmed pointing at Pages. Pin the architecture so milestone 2+ stops being decisions and starts being typing.
2. **Submit flow (M)** — Anonymous upload page: drop a photo or video, optional caption (140 char), optional display name, submit button. Server validates type/size, pushes media to R2/Stream, writes a row to D1 with `pending_review` status. Plain HTML form — no SPA.
3. **Moderation queue (S)** — Single-admin web page at `/admin` behind a Cloudflare Access policy locked to forbesdever's email. Lists pending submissions, approve/reject buttons, hotkeys (J/K/A/R). Approved → public, rejected → soft-deleted. **Pre-publish queue is non-negotiable for v1** (legal exposure).
4. **Swipe-rank UI (M)** — The main page. Shows one approved submission at a time, full-bleed, cinematic. Two buttons: "cowboy" / "not cowboy" (or swipe right/left on touch). Records a vote, advances. One vote per submission per IP+UA hash per 24h. Elo-style rating updates the submission's score on each vote.
5. **Leaderboard (S)** — `/leaderboard` page. Today's top 10, this week's top 10, all-time top 25. Auto-refresh every 60s. Each card links to a permalink (`/c/<slug>`).
6. **Permalink + share card (S)** — Each submission has its own page with the media, score, rank, and a generated OG image (Cloudflare Workers + canvas) showing the photo + score so shares to Twitter/iMessage look good.
7. **Legal pages + report button (S)** — ToS, privacy policy, DMCA contact, "report this" button on every submission. Boilerplate-grade is fine — the goal is having something pointable, not winning a lawsuit.
8. **Launch (S)** — Soft-launch to forbesdever's circles + a few cowboy-adjacent accounts. Watch logs. Don't post to Reddit yet.

**Phase 2 — keep people coming back (post-launch, weeks 3–6)**

9. Daily winner archive + "Hall of Fame" page.
10. Categories surfaced AFTER submit (admin tags during review): rodeo, ranch, boots, trucks, dogs, dust, hats, fits, fails. Filter the feed by tag.
11. Optional accounts (Google + X OAuth only — no email/password). Logged-in users get a one-vote-per-account constraint instead of IP-hash, and a tiny "submitted by" link to a thin profile.
12. Weekly themed prompts ("most cowboy boot," "best dog at work") with their own mini-leaderboards.
13. Auto-NSFW screening (Cloudflare AI image-classification or Rekognition) to take obvious junk out of the queue before forbesdever sees it.

**Phase 3 — make money, if it's worth making (month 2+, only if traction)**

14. Merch (Printful or Fourthwall, hooked to the hall-of-fame designs).
15. "Cowboy of the Month" sponsored slot — one paid placement per month, clearly labeled.
16. Maybe an iOS app wrapper (Capacitor) if mobile web hits a ceiling.

## Stack & tools

Concrete picks. Defaults toward Cloudflare because it's where the project already lives and bandwidth is free, which is the single biggest cost variable for a UGC site that might go viral.

- **Frontend:** Stay vanilla HTML + a sprinkle of vanilla JS for the swipe interactions and a small fetch layer. _Why:_ the brand is cinematic and bespoke; SPA frameworks are a tax we don't need at this scale. If we hit complexity in phase 2, migrate to Astro (server-rendered, keeps the no-build-by-default feel). **No React for v1.**
- **Backend:** Cloudflare Workers (TypeScript) + Hono router. _Why:_ free tier covers us, runs on the edge next to R2/Stream, no VPS to babysit. The Vultr box stays parked for justranching.
- **Database:** Cloudflare D1 (SQLite at the edge). _Why:_ schema is small (submissions, votes, reports, optional users), D1 is plenty for >100k submissions and >10M votes. Migrate to Postgres on the Vultr box only if we outgrow it — we won't in v1.
- **Object storage:** Cloudflare R2. _Why:_ zero egress fees, S3-compatible API, lives in the same control plane.
- **Image pipeline:** Cloudflare Images. _Why:_ resize/optimize/serve variants from one URL, $5/mo for 100k images stored.
- **Video pipeline:** Cloudflare Stream. _Why:_ ingests phone .MOV / .mp4 / .mov directly, transcodes to HLS, serves with their player. Solves the .MOV-won't-play-in-browser problem for every uploader. ~$1 per 1k minutes delivered + $5 per 1k minutes stored.
- **Auth (when we add it, phase 2):** Clerk or Lucia + OAuth. Lean Lucia (self-hosted on Workers) — cheaper, fewer dependencies, the auth surface is tiny.
- **Admin gate:** Cloudflare Access (free for under 50 users) locked to forbesdever's email. No login UI to build.
- **Error tracking:** Sentry free tier.
- **Analytics:** Cloudflare Web Analytics (free, privacy-friendly, no cookie banner needed).
- **NSFW detection (phase 2):** Cloudflare Workers AI `@cf/microsoft/resnet-50` or the dedicated NSFW image classifier — runs at the edge, pennies per call.
- **Rate limiting:** Cloudflare Rate Limiting rules at the edge — covers vote-rigging and submit-spam without app-layer code.
- **Domain/DNS:** Already on Cloudflare. Confirm cowboysdocowboyshit.com → Pages wiring on day one.
- **CI/deploy:** Wrangler + GitHub Actions, auto-deploy Workers on push to `main`. Pages already auto-deploys.

Total expected v1 monthly cost: **$5–25/mo** until traffic gets serious.

## Features

**Submission**
- Anonymous upload (photo: jpg/png/heic/webp; video: mov/mp4, max 30s, max 100MB)
- Optional caption (140 char) + optional display name
- Server-side type/size validation, EXIF stripped from photos
- Auto-transcode video via Stream (HLS output, poster frame extracted)
- Auto-thumbnail extraction for video; auto-orientation fix for photos
- Submission lands in moderation queue with `pending_review` status
- Submitter sees a "thanks, we'll review it" confirmation with a status link

**Ranking / voting**
- Full-bleed swipe interface: one submission at a time
- Two outcomes per vote: cowboy / not cowboy
- Touch swipe (left/right) + keyboard (←/→) + click buttons
- Elo-style rating: every vote is "this submission vs the implicit average submission" — start everyone at 1000, K=32, decay K to 16 after 50 votes
- Anti-gaming: one vote per submission per IP+UA hash per 24h (phase 2: per account)
- "Skip" option that doesn't count

**Leaderboard / discovery**
- `/leaderboard` — today (resets at midnight CT), this week, all-time
- Daily winner pinned to homepage for 24h after rollover
- Permalink page per submission with score + rank + share buttons
- OG image per submission for good link unfurls
- Random "show me a cowboy" button on every page

**Moderation (admin-only)**
- `/admin` queue: pending submissions list, approve/reject, hotkeys
- Reject reasons (optional dropdown): NSFW, off-topic, spam, copyrighted, other
- Soft-delete only — keep evidence in DB for 30 days in case of disputes
- Public report button on every submission → adds to a "reported" admin view
- Auto-takedown if a submission gets >5 reports (re-queues for re-review)

**Legal / safety pages**
- ToS (boilerplate + UGC clauses + age gate: 18+ self-attestation on submit)
- Privacy policy (what we store, how long, how to delete)
- DMCA page with a real email address that forwards to forbesdever
- "Why was my submission removed" page

**Plumbing**
- 404 page (cowboy-themed)
- 500 page
- Empty state on the swipe feed ("you've voted on everything, check back tomorrow")
- Loading states (skeleton frame for media)
- Health check endpoint for monitoring

## Interface

Two visual registers, deliberately:

- **Marketing surface (homepage hero, leaderboard, permalinks):** keep the cinematic landing-page aesthetic — Cinzel display type, vignette, dark, full-bleed media. This is the brand.
- **Voting surface (the swipe feed):** strip it down. Full-bleed media, two giant buttons, tiny score readout, nothing else. Utilitarian, fast, thumb-driven. The cinematic thing gets in the way when you're voting #47 in a row.

**Key screens:**

1. `/` — hero (cinematic) + "vote now" CTA + today's #1 submission embedded + "submit yours" CTA
2. `/vote` — the swipe feed (utilitarian, full-bleed)
3. `/submit` — single-page upload form (utilitarian, plain)
4. `/leaderboard` — today / week / all-time tabs (cinematic typography, dense layout)
5. `/c/<slug>` — submission permalink (cinematic, share-shaped)
6. `/about`, `/terms`, `/privacy`, `/dmca`, `/report` — text pages
7. `/admin` — queue (utilitarian, dense, hotkey-driven)

Cow motif: lock it down on day one — small SVG cow as favicon and as a tiny mark above the wordmark. No further cow placement until the product works.

## Backup, safety, ops

- **DB backups:** D1 has automatic point-in-time recovery built in. Add a nightly `wrangler d1 export` cron to R2 as belt-and-braces (30-day retention).
- **Media backups:** R2 has 11-nines durability; not adding a second region in v1. Originals kept in R2; Stream keeps its own encoded copies.
- **Deploy pipeline:** push to `main` → GitHub Actions → `wrangler deploy` for Workers, Pages auto-deploys static. Rollback = `wrangler rollback` or revert the commit.
- **Monitoring:** Cloudflare's built-in Worker analytics (errors, latency, requests) + Sentry for exceptions. UptimeRobot pinging the homepage every 5 minutes — free.
- **Viral surge plan:** Cloudflare's edge handles bandwidth for free, which is the killer feature here. Workers free tier = 100k requests/day, paid = $5/mo for 10M requests/day. D1 paid = $5/mo for 25B reads/mo. R2 = $0.015/GB stored, no egress. **The cost ceiling for a viral day is roughly $50, not $5,000.** Set a Cloudflare billing alert at $100/mo as the canary.
- **Rate limits:** Cloudflare rules — 5 submits per IP per hour, 200 votes per IP per hour. Tunable from the dashboard, no deploy needed.
- **Security basics:** signed upload URLs (clients never write directly to R2 with shared creds), CSRF tokens on the admin actions, secrets in Wrangler env vars, all traffic forced HTTPS by Cloudflare.
- **Incident plan:** if something illegal lands publicly — kill switch endpoint that flips a global `feed_paused=true` flag in D1. The vote feed shows a maintenance message; submissions still queue but nothing renders. Single page to flip back when handled.

## Business layer

Who: bored phone-scrollers who think the premise is funny. Discovery: organic shares of permalink pages with good OG cards, rodeo/ranch creators reposting their own submissions, Reddit (r/cowboys, r/RedDeadOnline, r/funny when ready), TikTok screen recordings of the swipe UI. The viral handle is the permalink card — when someone wins "Most Cowboy Today" they want to share that.

Monetization: **default = free, unmonetized for v1, intentionally.** Validate the loop, then layer in:
- **Merch first.** Fits the brand, fits the audience, fits the founder. Hall-of-fame submissions become limited-run shirts/stickers; revenue split with the submitter (50/50 is generous and a good story).
- **Sponsored "Cowboy of the Month"** slot — one paid placement, clearly labeled, $500–2000/mo when traffic justifies it.
- **No ads.** Display ads kill the aesthetic and pay nothing at this scale.
- **No premium accounts.** Nothing to gate.

v1 success metric (60 days post-launch): 1,000 approved submissions, 50,000 votes, one organic moment where a submission gets shared somewhere we didn't post it. If we don't hit that, the loop isn't working — fix the loop, don't add features.

## Risks

1. **Moderation blowup.** Within 24h of going viral, someone uploads CSAM, gore, or a copyrighted clip with a sharp lawyer behind it. _Mitigation:_ pre-publish queue is a HARD requirement in v1 (no auto-publish), kill switch endpoint, DMCA contact actually monitored, ToS makes 18+ self-attestation a submit gate. Phase 2: automated NSFW classifier in front of the queue so forbesdever doesn't see the worst of it.
2. **Founder burnout on moderation.** Every submission goes through forbesdever's eyes in v1 — that's fine at 50/day, miserable at 5,000/day. _Mitigation:_ phase 2 adds the auto-classifier and an "approver" role we can hand to a trusted friend. Build that before traffic demands it (target: when sustained submit rate >100/day for a week).
3. **Project stalls in phase 1.** The most likely failure mode is the swipe UI getting over-polished and never shipping. _Mitigation:_ milestone 4 ships with two HTML buttons, no animation library, no swipe gesture polish — that all comes after launch. Force the boring v1.

## Open decisions

Three calls that need forbesdever's input before milestone 1 starts. Each has a recommended pick — push back if you disagree.

1. **Ranking mechanic — pairwise swipe vs upvote/downvote feed?**
   - **Recommended: pairwise-ish swipe (cowboy / not cowboy on one item at a time), Elo-rated.** Higher engagement per session, fits the brand, explains the leaderboard naturally. The pure pairwise "which of these two is more cowboy" version is more accurate but slower to build and harder to share single permalinks from — defer it.
   - Alternative: classic upvote/downvote feed (Reddit-style). Easier to build, less fun, less differentiated.

2. **Anonymous submissions in v1, accounts deferred to phase 2 — confirm?**
   - **Recommended: yes, anonymous.** Removes the single biggest signup-funnel drop and matches the joke (it's not about you, it's about the cowboy shit). Vote-rigging is bounded by the per-IP rate limit. If it becomes a problem, accounts ship in phase 2 — not before.
   - Push back if you want OAuth-only signup gating uploads from day one. It's defensible, just slower to launch.

3. **Brand voice on legal/moderation pages — in-character or buttoned-up?**
   - **Recommended: buttoned-up on ToS / privacy / DMCA, in-character everywhere else.** Funny ToS copy is a meme until someone's lawyer reads it. The 404 page can be a joke, the takedown form cannot.
   - Alternative: keep voice consistent everywhere. Riskier; only do it if you're willing to lawyer-review later.
