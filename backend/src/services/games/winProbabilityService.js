import axios from "axios";
import { cached } from "../../cache/cache.js";
import { getSportPath } from "../../utils/sportPath.js";
import { parseClockToSeconds } from "../../utils/clock.js";
import logger from "../../logger.js";

const FINAL_TTL = 30 * 86400; // 30 days
const LIVE_TTL = 30; // 30 seconds

// ESPN doesn't ship win-probability data for NHL — only NBA and NFL.
const SUPPORTED_LEAGUES = new Set(["nba", "nfl"]);

function extractPlays(respData) {
  // NBA: plays at top level; NFL: plays nested inside drives
  const topLevel = respData?.plays;
  if (Array.isArray(topLevel) && topLevel.length > 0) return topLevel;
  const drives = respData?.drives?.previous ?? [];
  return drives.flatMap((d) => d.plays ?? []);
}

// ESPN re-emits plays after stat corrections (e.g. a foul gets reassigned 6 minutes later).
// The re-emitted entry sits later in the array but its play.clock points back to the
// original game time, which renders as a backward jump on the chart's time-based X-axis.
// Drop any entry whose (period, clock) is earlier than the last accepted entry.
function filterMonotonic(entries) {
  const out = [];
  let prevPeriod = -Infinity;
  let prevClock = Infinity;
  for (const dp of entries) {
    if (dp.period == null || dp.clock == null) {
      out.push(dp);
      continue;
    }
    if (dp.period < prevPeriod) continue;
    if (dp.period === prevPeriod && dp.clock > prevClock) continue;
    out.push(dp);
    prevPeriod = dp.period;
    prevClock = dp.clock;
  }
  return out;
}

export async function getWinProbability(league, espnEventId, isFinal) {
  if (!SUPPORTED_LEAGUES.has(league)) return null;

  const ttl = isFinal ? FINAL_TTL : LIVE_TTL;
  const key = `winprob:${league}:${espnEventId}`;

  return cached(
    key,
    ttl,
    async () => {
      const sport = getSportPath(league);
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${espnEventId}`;

      try {
        const resp = await axios.get(url, { timeout: 10000 });
        const raw = resp.data?.winprobability;
        if (!Array.isArray(raw) || raw.length === 0) return null;

        // Build a play lookup once — used for both period attribution and score margin.
        const plays = extractPlays(resp.data);
        const playMap = plays.length > 0
          ? new Map(plays.map((p) => [String(p.id), p]))
          : null;

        const winProbability = filterMonotonic(
          raw.map((dp) => {
            const play = playMap?.get(String(dp.playId));
            return {
              homeWinPercentage: dp.homeWinPercentage,
              playId: dp.playId,
              period: play?.period?.number ?? null,
              clock: parseClockToSeconds(play?.clock?.displayValue),
            };
          }),
        );

        let scoreMargin = null;
        if (playMap) {
          const matched = raw
            .map((dp) => {
              const play = playMap.get(String(dp.playId));
              if (!play || play.homeScore == null || play.awayScore == null) return null;
              return {
                playId: dp.playId,
                margin: play.homeScore - play.awayScore,
                period: play.period?.number ?? null,
                clock: parseClockToSeconds(play.clock?.displayValue),
              };
            })
            .filter(Boolean);
          if (matched.length > 0) scoreMargin = filterMonotonic(matched);
        }

        return { winProbability, scoreMargin };
      } catch (err) {
        logger.warn({ err, league, espnEventId }, "win probability fetch failed");
        return null;
      }
    },
    { cacheIf: (data) => data !== null }
  );
}
