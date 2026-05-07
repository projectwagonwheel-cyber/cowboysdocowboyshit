import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Env } from "../_lib/env";
import { voterHash } from "../_lib/hash";
import { newId } from "../_lib/slug";
import { nextRating } from "../_lib/elo";
import { getSetting, setSetting, mediaUrl, posterUrl, type Submission } from "../_lib/db";
import { isAdmin } from "../_lib/auth";
import { createDirectUpload, getStreamVideo } from "../_lib/stream";

type AppEnv = { Bindings: Env };
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", cors({ origin: (o) => o ?? "*", credentials: false }));

// ---------- helpers ----------

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function ext(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "bin";
}

function pickCaption(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 140);
}

function pickName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

// Submitter-side rate limit: 5 submits per hour per voter hash.
// (Cloudflare Rate Limiting Rules at the edge are the primary defense; this
// is a belt-and-braces app-layer check.)
async function checkSubmitRate(env: Env, hash: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM submissions
     WHERE submitter_hash = ? AND created_at > datetime('now', '-1 hour')`,
  )
    .bind(hash)
    .first<{ c: number }>();
  return (row?.c ?? 0) < 5;
}

// ---------- submit: photo ----------

app.post("/submit/photo", async (c) => {
  const hash = await voterHash(c.req.raw);
  if (!(await checkSubmitRate(c.env, hash))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "bad_form" }, 400);
  }

  const file = form.get("media");
  if (!(file instanceof File)) return c.json({ error: "no_file" }, 400);
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return c.json({ error: "size", limit: MAX_PHOTO_BYTES }, 400);
  }
  if (!PHOTO_TYPES.has(file.type)) {
    return c.json({ error: "type", got: file.type }, 400);
  }

  if (form.get("age_gate") !== "yes") {
    return c.json({ error: "age_gate" }, 400);
  }

  const id = newId();
  const slug = newId();
  const key = `submissions/${id}.${ext(file.type)}`;

  await c.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  await c.env.DB.prepare(
    `INSERT INTO submissions (id, slug, kind, media_key, caption, display_name, status, submitter_hash)
     VALUES (?, ?, 'photo', ?, ?, ?, 'pending_review', ?)`,
  )
    .bind(id, slug, key, pickCaption(form.get("caption")), pickName(form.get("display_name")), hash)
    .run();

  return c.json({ id, slug });
});

// ---------- submit: video (two-step direct upload to Stream) ----------

app.post("/submit/video/init", async (c) => {
  const hash = await voterHash(c.req.raw);
  if (!(await checkSubmitRate(c.env, hash))) {
    return c.json({ error: "rate_limited" }, 429);
  }
  let body: { caption?: string; display_name?: string; age_gate?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad_json" }, 400);
  }
  if (body.age_gate !== "yes") return c.json({ error: "age_gate" }, 400);

  const upload = await createDirectUpload(c.env, { maxDurationSeconds: MAX_VIDEO_SECONDS });
  const id = newId();
  const slug = newId();

  // Store the Stream UID in media_key for now; we'll patch it to the playback
  // URL on finalize once Stream tells us it's ready.
  await c.env.DB.prepare(
    `INSERT INTO submissions (id, slug, kind, media_key, caption, display_name, status, submitter_hash)
     VALUES (?, ?, 'video', ?, ?, ?, 'pending_review', ?)`,
  )
    .bind(
      id,
      slug,
      `stream:${upload.uid}`,
      pickCaption(body.caption ?? null),
      pickName(body.display_name ?? null),
      hash,
    )
    .run();

  return c.json({ id, slug, uploadURL: upload.uploadURL, uid: upload.uid });
});

app.post("/submit/video/finalize", async (c) => {
  const body = await c.req.json<{ id: string; uid: string }>();
  const sub = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(body.id)
    .first<Submission>();
  if (!sub) return c.json({ error: "not_found" }, 404);
  if (sub.kind !== "video" || sub.media_key !== `stream:${body.uid}`) {
    return c.json({ error: "mismatch" }, 400);
  }

  const video = await getStreamVideo(c.env, body.uid);
  await c.env.DB.prepare(
    `UPDATE submissions SET media_key = ?, poster_key = ? WHERE id = ?`,
  )
    .bind(video.playback.hls, video.thumbnail, body.id)
    .run();

  return c.json({ ok: true, slug: sub.slug });
});

// ---------- submission status (post-submit "thanks" page) ----------

app.get("/submission/:slug/status", async (c) => {
  const sub = await c.env.DB.prepare(
    "SELECT slug, status, reject_reason FROM submissions WHERE slug = ?",
  )
    .bind(c.req.param("slug"))
    .first<Pick<Submission, "slug" | "status" | "reject_reason">>();
  if (!sub) return c.json({ error: "not_found" }, 404);
  return c.json(sub);
});

// ---------- voting feed ----------

app.get("/feed/next", async (c) => {
  const paused = await getSetting(c.env, "feed_paused");
  if (paused === "1") return c.json({ paused: true }, 503);

  const hash = await voterHash(c.req.raw);
  const sub = await c.env.DB.prepare(
    `SELECT * FROM submissions s
     WHERE s.status = 'approved'
       AND s.submitter_hash != ?
       AND NOT EXISTS (
         SELECT 1 FROM votes v
         WHERE v.submission_id = s.id AND v.voter_hash = ?
       )
     ORDER BY RANDOM()
     LIMIT 1`,
  )
    .bind(hash, hash)
    .first<Submission>();

  if (!sub) return c.json({ done: true });

  return c.json({
    id: sub.id,
    slug: sub.slug,
    kind: sub.kind,
    media_url: mediaUrl(c.env, sub),
    poster_url: posterUrl(c.env, sub),
    caption: sub.caption,
    display_name: sub.display_name,
    rating: Math.round(sub.rating),
    vote_count: sub.vote_count,
  });
});

// ---------- vote ----------

app.post("/vote", async (c) => {
  const paused = await getSetting(c.env, "feed_paused");
  if (paused === "1") return c.json({ paused: true }, 503);

  const body = await c.req.json<{ id: string; outcome: "cowboy" | "not_cowboy" }>();
  if (body.outcome !== "cowboy" && body.outcome !== "not_cowboy") {
    return c.json({ error: "bad_outcome" }, 400);
  }

  const hash = await voterHash(c.req.raw);
  const sub = await c.env.DB.prepare(
    "SELECT * FROM submissions WHERE id = ? AND status = 'approved'",
  )
    .bind(body.id)
    .first<Submission>();
  if (!sub) return c.json({ error: "not_found" }, 404);

  const newRating = nextRating(sub.rating, sub.vote_count, body.outcome);
  const cowboyDelta = body.outcome === "cowboy" ? 1 : 0;

  // INSERT first; if the unique constraint trips, we know they already voted.
  try {
    await c.env.DB.prepare(
      "INSERT INTO votes (submission_id, voter_hash, outcome) VALUES (?, ?, ?)",
    )
      .bind(body.id, hash, body.outcome)
      .run();
  } catch (e: unknown) {
    if (String(e).includes("UNIQUE")) {
      return c.json({ error: "already_voted" }, 409);
    }
    throw e;
  }

  await c.env.DB.prepare(
    `UPDATE submissions
     SET rating = ?, vote_count = vote_count + 1, cowboy_count = cowboy_count + ?
     WHERE id = ?`,
  )
    .bind(newRating, cowboyDelta, body.id)
    .run();

  return c.json({ ok: true, rating: Math.round(newRating) });
});

// ---------- leaderboard ----------

app.get("/leaderboard", async (c) => {
  const period = c.req.query("period") ?? "all";
  let where = "status = 'approved'";
  let limit = 25;

  if (period === "today") {
    where += " AND approved_at > datetime('now', '-1 day')";
    limit = 10;
  } else if (period === "week") {
    where += " AND approved_at > datetime('now', '-7 days')";
    limit = 10;
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, slug, kind, media_key, poster_key, caption, display_name,
            rating, vote_count, cowboy_count
     FROM submissions
     WHERE ${where} AND vote_count >= 3
     ORDER BY rating DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<Submission>();

  return c.json({
    period,
    items: (rows.results ?? []).map((s) => ({
      slug: s.slug,
      kind: s.kind,
      media_url: mediaUrl(c.env, s),
      poster_url: posterUrl(c.env, s),
      caption: s.caption,
      display_name: s.display_name,
      rating: Math.round(s.rating),
      vote_count: s.vote_count,
      cowboy_count: s.cowboy_count,
    })),
  });
});

// ---------- daily winner pin (yesterday's #1) ----------

app.get("/winner/today", async (c) => {
  const sub = await c.env.DB.prepare(
    `SELECT * FROM submissions
     WHERE status = 'approved'
       AND approved_at > datetime('now', '-1 day')
       AND vote_count >= 5
     ORDER BY rating DESC
     LIMIT 1`,
  ).first<Submission>();
  if (!sub) return c.json({ winner: null });
  return c.json({
    winner: {
      slug: sub.slug,
      kind: sub.kind,
      media_url: mediaUrl(c.env, sub),
      poster_url: posterUrl(c.env, sub),
      caption: sub.caption,
      display_name: sub.display_name,
      rating: Math.round(sub.rating),
    },
  });
});

// ---------- reports ----------

app.post("/report", async (c) => {
  const body = await c.req.json<{ id: string; reason?: string }>();
  const hash = await voterHash(c.req.raw);
  const sub = await c.env.DB.prepare("SELECT id FROM submissions WHERE id = ?")
    .bind(body.id)
    .first<{ id: string }>();
  if (!sub) return c.json({ error: "not_found" }, 404);

  try {
    await c.env.DB.prepare(
      "INSERT INTO reports (submission_id, reporter_hash, reason) VALUES (?, ?, ?)",
    )
      .bind(body.id, hash, body.reason?.slice(0, 200) ?? null)
      .run();
  } catch (e: unknown) {
    if (String(e).includes("UNIQUE")) return c.json({ ok: true });
    throw e;
  }

  // Auto-requeue at >5 reports.
  await c.env.DB.prepare(
    `UPDATE submissions SET report_count = report_count + 1 WHERE id = ?`,
  )
    .bind(body.id)
    .run();
  await c.env.DB.prepare(
    `UPDATE submissions SET status = 'pending_review'
     WHERE id = ? AND status = 'approved' AND report_count >= 5`,
  )
    .bind(body.id)
    .run();

  return c.json({ ok: true });
});

// ---------- admin (Cloudflare Access gated) ----------

const adminGuard: import("hono").MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c.req.raw, c.env)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};

app.use("/admin/*", adminGuard);

app.get("/admin/queue", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, slug, kind, media_key, poster_key, caption, display_name,
            report_count, created_at
     FROM submissions
     WHERE status = 'pending_review'
     ORDER BY created_at ASC
     LIMIT 50`,
  ).all<Submission>();
  return c.json({
    items: (rows.results ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      kind: s.kind,
      media_url: mediaUrl(c.env, s),
      poster_url: posterUrl(c.env, s),
      caption: s.caption,
      display_name: s.display_name,
      report_count: s.report_count,
      created_at: s.created_at,
    })),
  });
});

app.post("/admin/approve", async (c) => {
  const { id } = await c.req.json<{ id: string }>();
  await c.env.DB.prepare(
    `UPDATE submissions
     SET status = 'approved', approved_at = datetime('now'), reviewed_at = datetime('now'),
         reject_reason = NULL
     WHERE id = ?`,
  )
    .bind(id)
    .run();
  return c.json({ ok: true });
});

app.post("/admin/reject", async (c) => {
  const { id, reason } = await c.req.json<{ id: string; reason?: string }>();
  await c.env.DB.prepare(
    `UPDATE submissions
     SET status = 'rejected', reviewed_at = datetime('now'), reject_reason = ?
     WHERE id = ?`,
  )
    .bind(reason ?? null, id)
    .run();
  return c.json({ ok: true });
});

app.post("/admin/remove", async (c) => {
  const { id } = await c.req.json<{ id: string }>();
  await c.env.DB.prepare(
    `UPDATE submissions
     SET status = 'removed', reviewed_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(id)
    .run();
  return c.json({ ok: true });
});

app.get("/admin/reports", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, slug, kind, media_key, poster_key, caption, display_name,
            report_count, status
     FROM submissions
     WHERE report_count > 0
     ORDER BY report_count DESC, created_at DESC
     LIMIT 50`,
  ).all<Submission>();
  return c.json({
    items: (rows.results ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      kind: s.kind,
      media_url: mediaUrl(c.env, s),
      poster_url: posterUrl(c.env, s),
      caption: s.caption,
      display_name: s.display_name,
      report_count: s.report_count,
      status: s.status,
    })),
  });
});

// ---------- kill switch (bearer-token gated; usable from a phone) ----------

app.post("/kill-switch", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  if (auth !== `Bearer ${c.env.KILL_SWITCH_TOKEN}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const { paused } = await c.req.json<{ paused: boolean }>();
  await setSetting(c.env, "feed_paused", paused ? "1" : "0");
  return c.json({ ok: true, paused: !!paused });
});

// ---------- health ----------

app.get("/health", (c) => c.json({ ok: true, t: Date.now() }));

// ---------- Pages Functions entrypoint ----------

export const onRequest: PagesFunction<Env> = (ctx) =>
  app.fetch(ctx.request, ctx.env, {
    waitUntil: ctx.waitUntil.bind(ctx),
    passThroughOnException: ctx.passThroughOnException.bind(ctx),
    props: {},
  });
