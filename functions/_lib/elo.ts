// Elo against an implicit average opponent (rating 1000). One vote = one
// match. K decays after 50 votes so early ratings move fast and stabilize
// later. "cowboy" = win, "not_cowboy" = loss.
const OPPONENT_RATING = 1000;

export function nextRating(
  current: number,
  voteCount: number,
  outcome: "cowboy" | "not_cowboy",
): number {
  const k = voteCount < 50 ? 32 : 16;
  const expected =
    1 / (1 + Math.pow(10, (OPPONENT_RATING - current) / 400));
  const score = outcome === "cowboy" ? 1 : 0;
  return current + k * (score - expected);
}
