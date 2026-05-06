import pool from "../../../../db/db.js";
import { MINUTES_FILTER_SQL } from "../../../../utils/statFilters.js";

// Map of league → stat name → exact DB column name.
// Using a lookup map (not string interpolation) prevents SQL injection if the
// whitelist check is ever bypassed or a new league is added incorrectly.
const STAT_COLUMNS = {
  nba: {
    points: "points",
    assists: "assists",
    rebounds: "rebounds",
    steals: "steals",
    blocks: "blocks",
    turnovers: "turnovers",
    minutes: "minutes",
  },
  nfl: { yds: "yds", td: "td", interceptions: "interceptions" },
  nhl: { g: "g", a: "a", shots: "shots", saves: "saves", pim: "pim" },
};

export async function getStatLeaders(
  league,
  stat,
  season = null,
  limit = 10,
  { seasonStart, seasonEnd } = {},
) {
  const leagueColumns = STAT_COLUMNS[league];
  const safeColumn = leagueColumns?.[stat];
  if (!safeColumn) {
    const valid = leagueColumns ? Object.keys(leagueColumns).join(", ") : "";
    return { error: `Invalid stat '${stat}' for league '${league}'. Valid options: ${valid}` };
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);

  const params = [league];
  const where = [
    "g.league = $1",
    "g.status ILIKE 'Final%'",
    "g.type IN ('regular', 'makeup')",
    `s.${safeColumn} IS NOT NULL`,
    MINUTES_FILTER_SQL,
  ];

  const useRange = !season && (seasonStart || seasonEnd);
  if (useRange) {
    if (seasonStart) {
      params.push(seasonStart);
      where.push(`g.season >= $${params.length}`);
    }
    if (seasonEnd) {
      params.push(seasonEnd);
      where.push(`g.season <= $${params.length}`);
    }
  } else {
    params.push(season);
    where.push(
      `g.season = COALESCE($${params.length}, (SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL))`,
    );
  }

  params.push(safeLimit);

  const result = await pool.query(
    `SELECT p.id, p.name, p.position,
            t.id AS team_id, t.shortname AS team,
            ROUND(AVG(s.${safeColumn})::numeric, 1) AS avg_stat,
            SUM(s.${safeColumn}) AS total_stat,
            COUNT(*) AS games_played
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     JOIN teams t ON t.id = p.teamid
     WHERE ${where.join(" AND ")}
     GROUP BY p.id, p.name, p.position, t.id, t.shortname
     HAVING COUNT(*) >= 5
     ORDER BY avg_stat DESC
     LIMIT $${params.length}`,
    params,
  );
  return {
    stat,
    league,
    season: useRange ? null : season,
    seasonStart: useRange ? seasonStart || null : null,
    seasonEnd: useRange ? seasonEnd || null : null,
    leaders: result.rows,
  };
}
