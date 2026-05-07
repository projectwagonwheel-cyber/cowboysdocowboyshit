import type { Env } from "./env";

export type Submission = {
  id: string;
  slug: string;
  kind: "photo" | "video";
  media_key: string;
  poster_key: string | null;
  caption: string | null;
  display_name: string | null;
  status: "pending_review" | "approved" | "rejected" | "removed";
  reject_reason: string | null;
  rating: number;
  vote_count: number;
  cowboy_count: number;
  report_count: number;
  submitter_hash: string;
  created_at: string;
  approved_at: string | null;
  reviewed_at: string | null;
};

export async function getSubmissionBySlug(
  env: Env,
  slug: string,
): Promise<Submission | null> {
  return env.DB.prepare("SELECT * FROM submissions WHERE slug = ?")
    .bind(slug)
    .first<Submission>();
}

export async function getSetting(
  env: Env,
  key: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = ?",
  )
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(
  env: Env,
  key: string,
  value: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  )
    .bind(key, value)
    .run();
}

export function publicMediaUrl(env: Env, key: string): string {
  return `${env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

// Stream playback URLs follow the pattern customer-<code>.cloudflarestream.com.
// We don't know the customer code at code-time; the upload response gives us a
// `playback.hls` URL that we store directly in media_key for video kinds.
// For now we treat media_key as already a fully-qualified URL when kind=video,
// and as an R2 object key when kind=photo.
export function mediaUrl(env: Env, sub: Pick<Submission, "kind" | "media_key">): string {
  return sub.kind === "video" ? sub.media_key : publicMediaUrl(env, sub.media_key);
}

export function posterUrl(env: Env, sub: Pick<Submission, "kind" | "media_key" | "poster_key">): string | null {
  if (sub.kind === "photo") return publicMediaUrl(env, sub.media_key);
  if (sub.poster_key) return sub.poster_key;
  return null;
}
