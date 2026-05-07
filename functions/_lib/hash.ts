// Stable per-voter hash from IP + UA. Used to dedupe votes and rate-limit
// without storing raw IPs. Salted to make rainbow lookups useless.
const SALT = "cowboyshit-v1";

export async function voterHash(req: Request): Promise<string> {
  const ip = req.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ua = req.headers.get("User-Agent") ?? "";
  const data = new TextEncoder().encode(`${SALT}|${ip}|${ua}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
