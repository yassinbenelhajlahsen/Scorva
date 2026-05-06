import pool from "../../../../db/db.js";
import { MINUTES_FILTER_BY_LEAGUE } from "../../../../utils/statFilters.js";

const SEASON_AGG_BY_LEAGUE = {
  nba: `
    ROUND(AVG(s.points)::numeric, 1) AS ppg,
    ROUND(AVG(s.rebounds)::numeric, 1) AS rpg,
    ROUND(AVG(s.assists)::numeric, 1) AS apg,
    ROUND(AVG(s.steals)::numeric, 1) AS spg,
    ROUND(AVG(s.blocks)::numeric, 1) AS bpg,
    ROUND(AVG(s.turnovers)::numeric, 1) AS tpg,
    ROUND(AVG(s.minutes)::numeric, 1) AS mpg`,
  nfl: `
    SUM(s.yds) AS total_yds,
    SUM(s.td) AS total_td,
    SUM(s.interceptions) AS total_int`,
  nhl: `
    SUM(s.g) AS total_g,
    SUM(s.a) AS total_a,
    ROUND(AVG(s.shots)::numeric, 1) AS shots_per_game,
    SUM(s.saves) AS total_saves,
    SUM(s.pim) AS total_pim`,
};

const BEST_GAME_STATS = {
  nba: ["points", "assists", "rebounds"],
  nfl: ["yds", "td"],
  nhl: ["g", "a", "shots"],
};

export async function getPlayerCareer({ league, playerId }) {
  if (!league || !playerId) return { error: "league and playerId required" };
  const seasonAgg = SEASON_AGG_BY_LEAGUE[league];
  if (!seasonAgg) return { error: `Invalid league: ${league}` };

  const minutesFilter = MINUTES_FILTER_BY_LEAGUE[league];

  const playerInfo = await pool.query(
    `SELECT p.id, p.name, p.position, t.id AS current_team_id, t.shortname AS current_team
     FROM players p LEFT JOIN teams t ON t.id = p.teamid WHERE p.id = $1`,
    [playerId],
  );
  if (!playerInfo.rows[0]) return { error: "Player not found" };

  const perSeason = await pool.query(
    `SELECT g.season,
            COUNT(*) AS games_played,
            ${seasonAgg}
     FROM stats s
     JOIN games g ON g.id = s.gameid
     WHERE s.playerid = $1
       AND g.league = $2
       AND g.status ILIKE 'Final%'
       AND g.type IN ('regular', 'makeup')
       AND ${minutesFilter}
     GROUP BY g.season
     ORDER BY g.season DESC`,
    [playerId, league],
  );

  // Career best games (top 1 per stat)
  const bestStats = BEST_GAME_STATS[league];
  const bestGames = {};
  for (const stat of bestStats) {
    const r = await pool.query(
      `SELECT s.${stat} AS value, g.id AS game_id, g.date, g.season,
              ht.shortname AS home, at.shortname AS away
       FROM stats s
       JOIN games g ON g.id = s.gameid
       JOIN teams ht ON ht.id = g.hometeamid
       JOIN teams at ON at.id = g.awayteamid
       WHERE s.playerid = $1 AND g.league = $2 AND s.${stat} IS NOT NULL
         AND g.status ILIKE 'Final%' AND ${minutesFilter}
       ORDER BY s.${stat} DESC
       LIMIT 1`,
      [playerId, league],
    );
    if (r.rows[0]) bestGames[stat] = r.rows[0];
  }

  return {
    player: playerInfo.rows[0],
    seasons: perSeason.rows,
    careerBestGames: bestGames,
  };
}
