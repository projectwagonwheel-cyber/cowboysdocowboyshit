import type { Env } from "../_lib/env";
import { getSubmissionBySlug, mediaUrl, posterUrl } from "../_lib/db";

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const slug = ctx.params.slug as string;
  const sub = await getSubmissionBySlug(ctx.env, slug);
  if (!sub || sub.status !== "approved") {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const media = mediaUrl(ctx.env, sub);
  const poster = posterUrl(ctx.env, sub);
  const score = Math.round(sub.rating);
  const credit = sub.display_name?.trim() || "anonymous cowboy";
  const captionLine = sub.caption?.trim() ? `“${sub.caption.trim()}”` : "";
  const title = `${score} cowboy points — by ${credit}`;
  const desc = captionLine || `Submitted to cowboysdocowboyshit.com. Vote on more cowboy shit.`;
  const ogImage = poster ?? media;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · cowboysdocowboyshit</title>
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:url" content="https://cowboysdocowboyshit.com/c/${esc(slug)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</head>
<body class="permalink">
  <header class="topbar">
    <a class="brand" href="/">cowboysdocowboyshit</a>
    <nav>
      <a href="/vote">vote</a>
      <a href="/leaderboard">leaderboard</a>
      <a href="/submit">submit</a>
    </nav>
  </header>
  <main class="permalink-main">
    <figure class="permalink-media">
      ${
        sub.kind === "photo"
          ? `<img src="${esc(media)}" alt="${esc(sub.caption ?? "")}" />`
          : `<iframe src="${esc(media.replace(/\/manifest\/video\.m3u8.*$/, "/iframe"))}" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>`
      }
    </figure>
    <div class="permalink-meta">
      <div class="score">${score}<span class="score-label"> cowboy points</span></div>
      <div class="caption">${captionLine ? esc(captionLine) : ""}</div>
      <div class="credit">submitted by ${esc(credit)}</div>
      <div class="permalink-actions">
        <a class="btn" href="/vote">vote on more</a>
        <button class="btn btn-secondary" type="button" data-share data-url="https://cowboysdocowboyshit.com/c/${esc(slug)}" data-title="${esc(title)}">share</button>
        <a class="btn btn-ghost" href="/report?id=${esc(sub.id)}">report</a>
      </div>
    </div>
  </main>
  <footer class="footer">
    <a href="/about">about</a>
    <a href="/terms">terms</a>
    <a href="/privacy">privacy</a>
    <a href="/dmca">dmca</a>
  </footer>
  <script src="/app.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
};

function notFoundHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>not found · cowboysdocowboyshit</title><link rel="stylesheet" href="/styles.css"></head><body class="text-page"><main><h1>this cowboy rode off</h1><p>That submission isn't here. Maybe it got removed, maybe the link is wrong.</p><p><a href="/">back to the saloon</a></p></main></body></html>`;
}
