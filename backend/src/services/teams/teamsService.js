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
  const isCurrent = effectiveSeason === currentSeason;
  const ttl = isCurrent ? 300 : 30 * 86400;

  return cached(`roster:${league}:${teamId}:${effectiveSeason}`, ttl, async () => {
    if (isCurrent) {
      const result = await pool.query(
        `SELECT id, name, position, jerseynum, image_url,
                status, status_description, status_updated_at, espn_playerid
           FROM players
          WHERE league = $1
            AND teamid = $2
          ORDER BY position NULLS LAST, name`,
        [league, teamId]
      );
      return result.rows;
    }

    const result = await pool.query(
      `SELECT DISTINCT
              p.id, p.name, p.position, p.jerseynum, p.image_url,
              p.status, p.status_description, p.status_updated_at, p.espn_playerid
         FROM players p
         JOIN stats s ON s.playerid = p.id
         JOIN games g ON s.gameid = g.id
        WHERE g.league = $1
          AND g.season = $3
          AND COALESCE(s.teamid, p.teamid) = $2
        ORDER BY p.position NULLS LAST, p.name`,
      [league, teamId, effectiveSeason]
    );
    return result.rows;
  });
}
