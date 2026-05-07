import type { Env } from "./env";

// Trust the email header set by Cloudflare Access. This is safe IF the route
// is behind an Access policy (configured in the Cloudflare dashboard); Access
// runs at the edge before the request reaches Pages Functions, and the header
// can't be spoofed from the public internet.
//
// If the route is NOT behind Access, this header doesn't exist and admin
// access fails closed.
export function isAdmin(req: Request, env: Env): boolean {
  const email = req.headers.get("Cf-Access-Authenticated-User-Email");
  const expected = env.ADMIN_EMAIL;
  if (!email || !expected) return false;
  return email.toLowerCase() === expected.toLowerCase();
}
