# cowboysdocowboyshit.com

People upload their cowboy shit. The internet ranks how cowboy it is.

## Quick start

```sh
npm install
npm run db:migrate:local
npm run dev               # http://localhost:8788
```

## Stack

Cloudflare Pages + Pages Functions (TypeScript / Hono) + D1 + R2 + Stream.
Vanilla HTML/CSS/JS frontend, no build step.

## Routes

| Route               | What                                       |
| ------------------- | ------------------------------------------ |
| `/`                 | Cinematic landing                          |
| `/vote`             | Swipe-rank feed (Elo)                      |
| `/submit`           | Upload form                                |
| `/leaderboard`      | Today / week / all-time                    |
| `/c/<slug>`         | Submission permalink (server-rendered OG)  |
| `/admin`            | Moderation queue (Cloudflare Access gated) |
| `/about`, `/terms`, `/privacy`, `/dmca`, `/report` | Static                  |

## Docs in this repo

- `CLAUDE.md` — architecture, conventions, layout
- `DEPLOY.md` — first-time deploy hand-off (the parts that need your hands)
- `.plans/ugc-platform.md` — the product plan
