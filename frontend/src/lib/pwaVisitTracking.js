const COUNT_KEY = "scorva:visit-count";
const LAST_KEY = "scorva:visit-last";
const ONE_HOUR_MS = 60 * 60 * 1000;

export function trackVisit() {
  const now = Date.now();
  const last = Number(localStorage.getItem(LAST_KEY));
  if (Number.isFinite(last) && last > 0 && now - last < ONE_HOUR_MS) return;
  const current = getVisitCount();
  localStorage.setItem(COUNT_KEY, String(current + 1));
  localStorage.setItem(LAST_KEY, String(now));
}

export function getVisitCount() {
  const raw = localStorage.getItem(COUNT_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
