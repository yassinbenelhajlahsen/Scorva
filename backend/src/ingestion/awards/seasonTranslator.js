const NBA_NHL_RE = /^(\d{4})-(\d{2})$/;
const NFL_RE = /^(\d{4})$/;

export function seasonMatchesLeague(league, seasonString) {
  if (typeof seasonString !== "string") return false;
  const lg = league?.toLowerCase();
  if (lg === "nfl") return NFL_RE.test(seasonString);
  if (lg === "nba" || lg === "nhl") return NBA_NHL_RE.test(seasonString);
  return false;
}

export function toEspnYear(league, seasonString) {
  if (typeof seasonString !== "string") {
    throw new Error(`Invalid season for ${league}: ${seasonString}`);
  }
  const lg = league?.toLowerCase();
  if (lg === "nfl") {
    const m = seasonString.match(NFL_RE);
    if (!m) throw new Error(`Invalid NFL season format: ${seasonString} (expected 'YYYY')`);
    return Number(m[1]);
  }
  if (lg === "nba" || lg === "nhl") {
    const m = seasonString.match(NBA_NHL_RE);
    if (!m) throw new Error(`Invalid ${lg.toUpperCase()} season format: ${seasonString} (expected 'YYYY-YY')`);
    const startYear = Number(m[1]);
    const endTwoDigit = Number(m[2]);
    const startCentury = Math.floor(startYear / 100) * 100;
    let endYear = startCentury + endTwoDigit;
    if (endYear < startYear) endYear += 100;
    return endYear;
  }
  throw new Error(`Unsupported league: ${league}`);
}

export function decrementSeason(league, seasonString) {
  const lg = league?.toLowerCase();
  if (lg === "nfl") {
    const m = seasonString.match(NFL_RE);
    if (!m) throw new Error(`Invalid NFL season format: ${seasonString}`);
    return String(Number(m[1]) - 1);
  }
  if (lg === "nba" || lg === "nhl") {
    const m = seasonString.match(NBA_NHL_RE);
    if (!m) throw new Error(`Invalid ${lg.toUpperCase()} season format: ${seasonString}`);
    const startYear = Number(m[1]) - 1;
    const endYear = (startYear + 1) % 100;
    return `${startYear}-${String(endYear).padStart(2, "0")}`;
  }
  throw new Error(`Unsupported league: ${league}`);
}
