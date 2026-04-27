import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";

export async function getTeamAvailableSeasons(league, teamId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT season FROM games
      WHERE league = $1
        AND season IS NOT NULL
        AND ($2::integer IN (hometeamid, awayteamid))
      ORDER BY season DESC`,
    [league, teamId]
  );
  return rows.map((r) => r.season);
}

export async function getTeamsByLeague(league) {
  return cached(`teams:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT *
         FROM teams
        WHERE league = $1
          AND conf IS NOT NULL
        ORDER BY conf, name`,
      [league]
    );
    return result.rows;
  });
}

export async function getTeamRoster(league, teamId, season) {
  const currentSeason = await getCurrentSeason(league);
  const effectiveSeason = season ?? currentSeason;
  const ttl = effectiveSeason === currentSeason ? 300 : 30 * 86400;

  return cached(`roster:${league}:${teamId}:${effectiveSeason}`, ttl, async () => {
    const result = await pool.query(
      `WITH latest_team AS (
         SELECT DISTINCT ON (s.playerid)
                s.playerid,
                COALESCE(s.teamid, p.teamid) AS team_id
           FROM stats s
           JOIN games g ON s.gameid = g.id
           JOIN players p ON s.playerid = p.id
          WHERE g.league = $1
            AND g.season = $3
            AND g.type IN ('regular', 'makeup', 'playoff', 'final')
          ORDER BY s.playerid, g.date DESC, g.id DESC
       )
       SELECT p.id, p.name, p.position, p.jerseynum, p.image_url,
              p.status, p.status_description, p.status_updated_at, p.espn_playerid
         FROM players p
         JOIN latest_team lt ON lt.playerid = p.id
        WHERE lt.team_id = $2
        ORDER BY p.position NULLS LAST, p.name`,
      [league, teamId, effectiveSeason]
    );
    return result.rows;
  });
}
