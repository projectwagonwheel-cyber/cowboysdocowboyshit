// Shared client glue. Keep this file vanilla — no build step, no framework.

// Web Share API for the "share" button on permalinks/leaderboard cards.
document.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest("[data-share]");
  if (!btn) return;
  const url = btn.getAttribute("data-url") || location.href;
  const title = btn.getAttribute("data-title") || document.title;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "link copied";
    setTimeout(() => (btn.textContent = "share"), 1500);
  } catch {
    prompt("copy this link", url);
  }
});
