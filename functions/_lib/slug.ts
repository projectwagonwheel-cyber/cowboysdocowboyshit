// Short, URL-safe IDs. 12 chars from a 32-char alphabet ≈ 60 bits of entropy,
// plenty for v1 collision avoidance.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
