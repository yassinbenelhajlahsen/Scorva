import axios from "axios";
import { cached } from "../cache/cache.js";
import { getSportPath } from "../ingestion/eventProcessor.js";
import logger from "../logger.js";

const FINAL_TTL = 30 * 86400; // 30 days
const LIVE_TTL = 30; // 30 seconds

function extractPlays(respData) {
  // NBA: plays at top level; NFL: plays nested inside drives
  const topLevel = respData?.plays;
  if (Array.isArray(topLevel) && topLevel.length > 0) return topLevel;
  const drives = respData?.drives?.previous ?? [];
  return drives.flatMap((d) => d.plays ?? []);
}

export async function getWinProbability(league, espnEventId, isFinal) {
  const ttl = isFinal ? FINAL_TTL : LIVE_TTL;
  const key = `winprob:v2:${league}:${espnEventId}`;

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

        const winProbability = raw.map((dp) => ({
          homeWinPercentage: dp.homeWinPercentage,
          playId: dp.playId,
        }));

        // Build score margin from play-level scores joined via playId
        const plays = extractPlays(resp.data);
        let scoreMargin = null;
        if (plays.length > 0) {
          const playMap = new Map(plays.map((p) => [String(p.id), p]));
          const matched = raw
            .map((dp) => {
              const play = playMap.get(String(dp.playId));
              if (!play) return null;
              return { playId: dp.playId, margin: play.homeScore - play.awayScore };
            })
            .filter(Boolean);
          if (matched.length > 0) scoreMargin = matched;
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
