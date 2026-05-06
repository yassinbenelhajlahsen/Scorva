import pool from "../../../../db/db.js";
import { MINUTES_FILTER_BY_LEAGUE } from "../../../../utils/statFilters.js";

const STAT_COLUMNS = {
  nba: {
    points: "points",
    assists: "assists",
    rebounds: "rebounds",
    steals: "steals",
    blocks: "blocks",
    turnovers: "turnovers",
  },
  nfl: { yds: "yds", td: "td", interceptions: "interceptions" },
  nhl: { g: "g", a: "a", shots: "shots", saves: "saves", pim: "pim" },
};

export async function getTopSingleGamePerformances({
  league,
  stat,
  seasonStart,
  seasonEnd,
  minValue,
  playerId,
  teamId,
  limit = 10,
}) {
  const leagueColumns = STAT_COLUMNS[league];
  const safeColumn = leagueColumns?.[stat];
  if (!safeColumn) {
    const valid = leagueColumns ? Object.keys(leagueColumns).join(", ") : "";
    return { error: `Invalid stat '${stat}' for league '${league}'. Valid: ${valid}` };
  }

  const minutesFilter = MINUTES_FILTER_BY_LEAGUE[league];
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 25);

  const params = [league];
  const where = [
    "g.league = $1",
    "g.status ILIKE 'Final%'",
    "g.type IN ('regular', 'makeup', 'playoff')",
    `s.${safeColumn} IS NOT NULL`,
    minutesFilter,
  ];

  if (seasonStart) {
    params.push(seasonStart);
    where.push(`g.season >= $${params.length}`);
  }
  if (seasonEnd) {
    params.push(seasonEnd);
    where.push(`g.season <= $${params.length}`);
  }
  if (minValue != null) {
    params.push(minValue);
    where.push(`s.${safeColumn} >= $${params.length}`);
  }
  if (playerId) {
    params.push(playerId);
    where.push(`s.playerid = $${params.length}`);
  }
  if (teamId) {
    params.push(teamId);
    where.push(`COALESCE(s.teamid, p.teamid) = $${params.length}`);
  }

  params.push(safeLimit);

  const result = await pool.query(
    `SELECT s.${safeColumn} AS value,
            p.id AS player_id, p.name AS player_name,
            t.id AS team_id, t.shortname AS team,
            g.id AS game_id, g.date, g.season, g.type AS game_type,
            ht.shortname AS home, at.shortname AS away,
            g.homescore, g.awayscore
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     LEFT JOIN teams t ON t.id = COALESCE(s.teamid, p.teamid)
     JOIN teams ht ON ht.id = g.hometeamid
     JOIN teams at ON at.id = g.awayteamid
     WHERE ${where.join(" AND ")}
     ORDER BY s.${safeColumn} DESC, g.date DESC
     LIMIT $${params.length}`,
    params,
  );

  return {
    league,
    stat,
    seasonStart: seasonStart || null,
    seasonEnd: seasonEnd || null,
    performances: result.rows,
  };
}
