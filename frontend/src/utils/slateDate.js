// Status group keys: "live" | "final" | "scheduled"
export function statusGroup(game) {
  const s = game?.status || "";
  if (s.includes("Final")) return "final";
  if (
    s.includes("In Progress") ||
    s.includes("Halftime") ||
    s.includes("End of Period")
  ) {
    return "live";
  }
  return "scheduled";
}

// Today's ET date, rolling back to yesterday before 6 AM ET so late-night
// viewers still see last night's finals (matches the existing LeagueSlate
// behavior — without it the rail goes empty between midnight and 6 AM).
export function getSlateDateET() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = parseInt(get("hour"), 10);
  if (h >= 6) return `${y}-${m}-${d}`;
  const prev = new Date(`${y}-${m}-${d}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(prev.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// "7:30PM ET" / "7PM ET" → minutes since midnight (for chronological sort).
// Returns 9999 for unparseable input so those pills sort to the end.
export function parseStartTime(s) {
  if (!s) return 9999;
  const m = s.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const pm = m[3].toUpperCase() === "PM";
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

// "7:30PM ET" → "7:30P"
export function compactTime(s) {
  if (!s) return "TBD";
  return s.replace(/\s*ET\s*$/i, "").replace(/([AP])M/i, "$1");
}

// First path segment → "nba" | "nfl" | "nhl" | null
const LEAGUE_SLUGS = new Set(["nba", "nfl", "nhl"]);
export function resolveLeagueFilter(pathname) {
  const seg = (pathname || "").split("/")[1] || "";
  return LEAGUE_SLUGS.has(seg) ? seg : null;
}
