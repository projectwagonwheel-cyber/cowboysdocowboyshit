# cowboysdocowboyshit.com

Landing page for cowboysdocowboyshit.com. Started as a quick cinematic teaser; the project will evolve past the landing page later.

## Stack

- Static HTML + CSS, no build step, no framework
- Auto-deploys to Cloudflare Pages on push to `main`
- Custom domain wiring is in progress (see "Status" below)

## Repo & hosting

- GitHub: https://github.com/projectwagonwheel-cyber/cowboysdocowboyshit
- Hosting: Cloudflare Pages (free, auto-deploy on push)
- DNS: Cloudflare
- Domain: cowboysdocowboyshit.com (newly acquired)

**Vultr is not used here.** The user has a Vultr VPS for justranching but this site is static and lives entirely on Cloudflare Pages. If the project later grows a backend, the typical split is: static frontend stays on Pages, app/server goes on Vultr.

## Local dev

```sh
# Just open index.html, or serve it:
python3 -m http.server 8000
```

No install step.

## File layout

```
index.html        Hero markup
styles.css        All styling (cinematic crossfade, vignette, type)
assets/           Photo + video source material (raw, unoptimized)
.claude/agents/   Project-specific agents (see below)
```

## Open questions / decisions in progress

These are unresolved — don't assume an answer, ask the user:

1. **Hero media** — assets/ has 3 .jpeg photos and 4 .MOV videos. The current page references `assets/photo-1.jpg` and `assets/photo-2.jpg` (placeholders that don't exist). The user has not yet picked which media to feature, and whether the hero is photo crossfade or looping video.
2. **Final copy** — current placeholder is "cowboys do cowboy shit" headline + "coming soon" tagline. Not confirmed.
3. **Where cows fit** — the user wants cows involved somewhere but hasn't decided where (favicon, logo mark, easter egg, background layer, dedicated section). Recommended default: favicon + small SVG cow above the title. Don't ship cows without confirming placement.
4. **Custom domain** — DNS-to-Pages wiring was in progress when the prior session ended. The Cloudflare Pages → GitHub connection state is unverified. Before iterating, confirm the site is actually deploying.

## Media notes (important)

The `.MOV` files in `assets/` are raw iPhone exports. **They will not play reliably in browsers.** Before wiring any video into the page it needs to be transcoded to web-friendly H.264 `.mp4` (and ideally a `.webm` fallback) and compressed. The `media-optimizer` agent handles this — see `.claude/agents/`.

## Conventions

- Small commits with verbose messages (the user prefers this).
- Don't add a build step, framework, or dependencies without asking. The whole point is that it's a single HTML file you can open.
- Don't add features beyond what the task asks for. No analytics, no email signup, no cookie banner unless requested.
- Comments: only when the WHY is non-obvious. The CSS animation timing has no surprises; the markup is self-explanatory.

## Status (last session: 2026-04-25 → 2026-04-28)

- Repo created and pushed to GitHub
- Initial scaffold committed (placeholder hero, raw assets in `assets/`)
- Cloudflare Pages connection: user said "i think im live" but never pasted the `*.pages.dev` URL — deployment status unverified
- Custom domain (cowboysdocowboyshit.com → Pages): not yet wired up
- Hero media not yet selected; raw `.MOV` files unoptimized
