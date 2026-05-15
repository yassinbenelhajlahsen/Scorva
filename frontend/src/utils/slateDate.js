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
// viewers still see last night's finals — without it the rail goes empty
// between midnight and 6 AM.
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

// ESPN emits "12AM ET" as a placeholder when the actual tipoff is unknown
// (game scheduled but time not announced). No real ET game starts at midnight,
// so treat it as missing everywhere.
export function isPlaceholderStartTime(s) {
  if (!s) return true;
  return /^12(?::00)?\s*AM\s*ET\s*$/i.test(s);
}

// Display form: "TBD" for missing/placeholder, otherwise the raw string.
export function displayStartTime(s) {
  return isPlaceholderStartTime(s) ? "TBD" : s;
}

// "7:30PM ET" / "7PM ET" → minutes since midnight (for chronological sort).
// Returns 9999 for unparseable/placeholder input so those pills sort to the end.
export function parseStartTime(s) {
  if (isPlaceholderStartTime(s)) return 9999;
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
  if (isPlaceholderStartTime(s)) return "TBD";
  return s.replace(/\s*ET\s*$/i, "").replace(/([AP])M/i, "$1");
}

// live → scheduled (chronological by start_time) → final
export function sortBySlateOrder(games) {
  const live = [];
  const scheduled = [];
  const final = [];
  for (const g of games) {
    const grp = statusGroup(g);
    if (grp === "live") live.push(g);
    else if (grp === "final") final.push(g);
    else scheduled.push(g);
  }
  scheduled.sort(
    (a, b) => parseStartTime(a.start_time) - parseStartTime(b.start_time)
  );
  return [...live, ...scheduled, ...final];
}

// First path segment → "nba" | "nfl" | "nhl" | null
const LEAGUE_SLUGS = new Set(["nba", "nfl", "nhl"]);
export function resolveLeagueFilter(pathname) {
  const seg = (pathname || "").split("/")[1] || "";
  return LEAGUE_SLUGS.has(seg) ? seg : null;
}
