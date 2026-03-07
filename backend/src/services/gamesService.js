import pool from "../db/db.js";
import { DateTime } from "luxon";

export async function getGames(league, { teamId, season, live } = {}) {
  const currentSeasonSubquery = `(SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL)`;
  const seasonClause = `g.season = COALESCE($2, ${currentSeasonSubquery})`;

  const selectFrom = `
    SELECT
      g.*,
      th.name AS home_team_name,
      th.shortname AS home_shortname,
      th.logo_url AS home_logo,
      ta.name AS away_team_name,
      ta.shortname AS away_shortname,
      ta.logo_url AS away_logo
    FROM games g
    JOIN teams th ON g.hometeamid = th.id
    JOIN teams ta ON g.awayteamid = ta.id
  `;

  const params = [league, season || null];

  // Team pages or historical season views: preserve original behavior
  if (teamId || season) {
    let query = selectFrom + `WHERE g.league = $1 AND ${seasonClause}`;
    if (teamId) {
      query += ` AND ($${params.length + 1}::integer IN (g.hometeamid, g.awayteamid))`;
      params.push(teamId);
    }
    query += ` ORDER BY g.date DESC`;
    if (!teamId) query += ` LIMIT 12`;
    const { rows } = await pool.query(query, params);
    return rows;
  }

  // Home/league page, current season: smart prioritization
  // Show today's full slate when live/final games exist; otherwise show nearest upcoming.
  const todayEST = DateTime.now().setZone("America/New_York").toFormat("yyyy-MM-dd");
  params.push(todayEST); // $3

  // When called from SSE live controller, skip the EXISTS check — we already
  // know games are in progress, so go straight to the today-slate query.
  let has_today_games;
  if (live) {
    has_today_games = true;
  } else {
    const checkQuery = `
      SELECT EXISTS(
        SELECT 1 FROM games
        WHERE league = $1
          AND season = COALESCE($2, ${currentSeasonSubquery})
          AND date = $3
          AND status NOT IN ('Scheduled', 'Postponed', 'Canceled')
      ) AS has_today_games
    `;
    ({ rows: [{ has_today_games }] } = await pool.query(checkQuery, params));
  }

  let query;
  if (has_today_games) {
    // Today has live/final games — show ALL of today's slate, ordered live > final > scheduled
    query = selectFrom + `
      WHERE g.league = $1
        AND ${seasonClause}
        AND g.date = $3
      ORDER BY
        CASE
          WHEN g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%' THEN 1
          WHEN g.status ILIKE '%Final%' THEN 2
          ELSE 3
        END ASC,
        g.id ASC
      LIMIT 12
    `;
  } else {
    // No live/final today — show nearest upcoming scheduled games, soonest first
    query = selectFrom + `
      WHERE g.league = $1
        AND ${seasonClause}
        AND g.date >= $3
        AND g.status = 'Scheduled'
      ORDER BY g.date ASC, g.id ASC
      LIMIT 12
    `;
  }

  const { rows } = await pool.query(query, params);
  return rows;
}
