import { cached } from "../../cache/cache.js";
import { getInjuriesForLeague } from "./injuriesReports.js";
import { getMovesForLeague } from "./movesReports.js";
import { getBirthdaysForLeague } from "./birthdaysReports.js";
import { getStreaksForLeague } from "./streaksReports.js";

const LEAGUES = ["nba", "nfl", "nhl"];
const TTL_SECONDS = 300; // 5 min
const TYPE_ORDER = { injury: 0, move: 1, streak: 2, birthday: 3 };

function compareReports(a, b) {
  const ad = new Date(a.date).getTime();
  const bd = new Date(b.date).getTime();
  if (ad !== bd) return bd - ad;
  const at = TYPE_ORDER[a.type] ?? 99;
  const bt = TYPE_ORDER[b.type] ?? 99;
  if (at !== bt) return at - bt;
  return String(a.id).localeCompare(String(b.id));
}

async function gather(league) {
  const results = await Promise.allSettled([
    getInjuriesForLeague(league),
    getMovesForLeague(league),
    getBirthdaysForLeague(league),
    getStreaksForLeague(league),
  ]);
  const out = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) out.push(...r.value);
  }
  out.sort(compareReports);
  return out;
}

export async function getReportsForLeague(league) {
  return cached(`reports:list:${league}`, TTL_SECONDS, () => gather(league));
}

export async function getReportsAcrossLeagues() {
  const results = await Promise.all(LEAGUES.map((l) => getReportsForLeague(l)));
  const merged = results.flat();
  merged.sort(compareReports);
  return merged;
}
