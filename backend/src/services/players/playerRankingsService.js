import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { resolveWindow } from "../games/topPerformancesService.js";

// How deep we report a player's rank. Anything beyond this surfaces as null
// in the API response (the UI shows a dashed line).
const TOP_N = 250;

// Mirror the filters used by topPerformancesService.queryRankings so a
// player-page rank matches the pulse top-25 leaderboard exactly.
const LIVE_STATUS_SQL = `(g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%')`;
const RATEABLE_STATUS_SQL = `(g.status ILIKE '%final%' OR ${LIVE_STATUS_SQL})`;

const TTL_BY_WINDOW = { week: 60, month: 5 * 60, season: 5 * 60 };

async function fetchLeaderboard(league, windowKey) {
  const season = windowKey === "season" ? await getCurrentSeason(league) : null;
  const cacheKey = windowKey === "season"
    ? `playerRankings:${league}:season:${season}`
    : `playerRankings:${league}:${windowKey}`;
  const ttl = TTL_BY_WINDOW[windowKey] ?? 60;

  return cached(cacheKey, ttl, async () => {
    const { predicate, binds } = resolveWindow(windowKey, { season, startIdx: 2 });

    const sql = `
      WITH player_totals AS (
        SELECT s.playerid, SUM(s.rating) AS total_rating
          FROM stats s
          JOIN games g ON g.id = s.gameid
         WHERE g.league = $1
           AND ${RATEABLE_STATUS_SQL}
           AND g.type IN ('regular','playoff','final','makeup')
           AND s.rating IS NOT NULL
           ${predicate ? `AND ${predicate}` : ""}
         GROUP BY s.playerid
        HAVING SUM(s.rating) IS NOT NULL
      )
      SELECT playerid,
             ROW_NUMBER() OVER (ORDER BY total_rating DESC, playerid ASC) AS rank
        FROM player_totals
       LIMIT ${TOP_N};
    `;
    const { rows } = await pool.query(sql, [league, ...binds]);
    return rows.map((r) => ({ playerid: Number(r.playerid), rank: Number(r.rank) }));
  });
}

function lookupRank(board, playerId) {
  const hit = board.find((r) => r.playerid === playerId);
  return hit ? hit.rank : null;
}

export async function getNbaPlayerRankings(playerId) {
  const [week, month, season] = await Promise.all([
    fetchLeaderboard("nba", "week"),
    fetchLeaderboard("nba", "month"),
    fetchLeaderboard("nba", "season"),
  ]);
  return {
    week: lookupRank(week, playerId),
    month: lookupRank(month, playerId),
    season: lookupRank(season, playerId),
  };
}
