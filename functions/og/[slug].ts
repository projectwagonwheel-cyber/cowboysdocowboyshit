import type { Env } from "../_lib/env";
import { getSubmissionBySlug, mediaUrl, posterUrl } from "../_lib/db";

// Phase 1 OG image = the submission's photo (or Stream poster). Generated
// score-overlay cards are deferred to phase 2 — see the plan.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const slug = ctx.params.slug as string;
  const sub = await getSubmissionBySlug(ctx.env, slug);
  if (!sub || sub.status !== "approved") {
    return new Response("not found", { status: 404 });
  }
  const url = sub.kind === "photo" ? mediaUrl(ctx.env, sub) : posterUrl(ctx.env, sub);
  if (!url) return new Response("no image", { status: 404 });
  return Response.redirect(url, 302);
};
