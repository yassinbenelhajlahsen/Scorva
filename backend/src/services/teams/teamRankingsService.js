import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { resolveWindow } from "../games/topPerformancesService.js";

const LIVE_STATUS_SQL = `(g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%')`;
const RATEABLE_STATUS_SQL = `(g.status ILIKE '%final%' OR ${LIVE_STATUS_SQL})`;

const TTL_BY_WINDOW = { week: 60, month: 5 * 60, season: 5 * 60 };

async function fetchTeamLeaderboard(league, windowKey) {
  const season = windowKey === "season" ? await getCurrentSeason(league) : null;
  const cacheKey = windowKey === "season"
    ? `teamRankings:${league}:season:${season}`
    : `teamRankings:${league}:${windowKey}`;
  const ttl = TTL_BY_WINDOW[windowKey] ?? 60;

  return cached(cacheKey, ttl, async () => {
    const { predicate, binds } = resolveWindow(windowKey, { season, startIdx: 2 });

    const sql = `
      WITH team_games AS (
        SELECT g.id AS gameid,
               CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid
                    THEN g.hometeamid ELSE g.awayteamid END AS team_id,
               SUM(s.rating) AS team_rating
          FROM stats s
          JOIN games g   ON g.id = s.gameid
          JOIN players p ON p.id = s.playerid
         WHERE g.league = $1
           AND ${RATEABLE_STATUS_SQL}
           AND g.type IN ('regular','playoff','final','makeup')
           AND s.rating IS NOT NULL
           ${predicate ? `AND ${predicate}` : ""}
         GROUP BY g.id, team_id
      ),
      team_totals AS (
        SELECT team_id, SUM(team_rating) AS total_rating
          FROM team_games
         GROUP BY team_id
        HAVING SUM(team_rating) IS NOT NULL
      )
      SELECT team_id,
             ROW_NUMBER() OVER (ORDER BY total_rating DESC, team_id ASC) AS rank
        FROM team_totals;
    `;
    const { rows } = await pool.query(sql, [league, ...binds]);
    return rows.map((r) => ({ teamid: Number(r.team_id), rank: Number(r.rank) }));
  });
}

function lookupRank(board, teamId) {
  const hit = board.find((r) => r.teamid === teamId);
  return hit ? hit.rank : null;
}

export async function getNbaTeamRankings(teamId) {
  const [week, month, season] = await Promise.all([
    fetchTeamLeaderboard("nba", "week"),
    fetchTeamLeaderboard("nba", "month"),
    fetchTeamLeaderboard("nba", "season"),
  ]);
  return {
    week: lookupRank(week, teamId),
    month: lookupRank(month, teamId),
    season: lookupRank(season, teamId),
  };
}
