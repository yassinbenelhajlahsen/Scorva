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

function rosterAveragesSql(league) {
  if (league === "nba") {
    return `json_build_object(
      'points', COALESCE(ROUND(AVG(s2.points) FILTER (WHERE g2.id IS NOT NULL AND s2.minutes > 0), 1), 0),
      'rebounds', COALESCE(ROUND(AVG(s2.rebounds) FILTER (WHERE g2.id IS NOT NULL AND s2.minutes > 0), 1), 0),
      'assists', COALESCE(ROUND(AVG(s2.assists) FILTER (WHERE g2.id IS NOT NULL AND s2.minutes > 0), 1), 0),
      'fgPct', COALESCE(
        ROUND(
          100.0 *
          COALESCE(SUM((split_part(s2.fg, '-', 1))::NUMERIC) FILTER (WHERE g2.id IS NOT NULL AND s2.minutes > 0), 0)
          /
          NULLIF(
            COALESCE(SUM((split_part(s2.fg, '-', 2))::NUMERIC) FILTER (WHERE g2.id IS NOT NULL AND s2.minutes > 0), 0),
            0
          ),
          1
        ),
        0
      )
    )`;
  }
  if (league === "nfl") {
    return `json_build_object(
      'yards', COALESCE(ROUND(AVG(s2.yds) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
      'td', COALESCE(ROUND(AVG(s2.td) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
      'interceptions', COALESCE(ROUND(AVG(s2.interceptions) FILTER (WHERE g2.id IS NOT NULL), 1), 0)
    )`;
  }
  // nhl
  return `json_build_object(
    'goals', COALESCE(ROUND(AVG(s2.g) FILTER (WHERE g2.id IS NOT NULL AND s2.toi IS NOT NULL AND s2.toi != '0:00'), 1), 0),
    'assists', COALESCE(ROUND(AVG(s2.a) FILTER (WHERE g2.id IS NOT NULL AND s2.toi IS NOT NULL AND s2.toi != '0:00'), 1), 0),
    'saves', COALESCE(ROUND(AVG(s2.saves) FILTER (WHERE g2.id IS NOT NULL AND s2.toi IS NOT NULL AND s2.toi != '0:00'), 1), 0)
  )`;
}

export async function getTeamRoster(league, teamId, season) {
  const currentSeason = await getCurrentSeason(league);
  const effectiveSeason = season ?? currentSeason;
  const ttl = effectiveSeason === currentSeason ? 300 : 30 * 86400;

  return cached(`roster:${league}:${teamId}:${effectiveSeason}`, ttl, async () => {
    const result = await pool.query(
      `WITH player_seasons AS (
         SELECT
           s.playerid,
           COALESCE(s.teamid, p.teamid) AS team_id,
           COUNT(*) OVER (PARTITION BY s.playerid) AS games_played,
           ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC, g.id DESC) AS rn
         FROM stats s
         JOIN games g ON s.gameid = g.id
         JOIN players p ON s.playerid = p.id
         WHERE g.league = $1
           AND g.season = $3
           AND g.type IN ('regular', 'makeup', 'playoff', 'final')
       )
       SELECT p.id, p.name, p.position, p.jerseynum, p.image_url,
              p.status, p.status_description, p.status_updated_at, p.espn_playerid,
              ${rosterAveragesSql(league)} AS averages
         FROM players p
         JOIN player_seasons ps ON ps.playerid = p.id AND ps.rn = 1
         LEFT JOIN stats s2 ON s2.playerid = p.id
         LEFT JOIN games g2 ON s2.gameid = g2.id
           AND g2.league = $1
           AND g2.season = $3
           AND g2.type IN ('regular', 'makeup')
           AND COALESCE(s2.teamid, p.teamid) = $2
        WHERE ps.team_id = $2
        GROUP BY p.id, p.name, p.position, p.jerseynum, p.image_url,
                 p.status, p.status_description, p.status_updated_at, p.espn_playerid,
                 ps.games_played
        ORDER BY ps.games_played DESC, p.position NULLS LAST, p.name`,
      [league, teamId, effectiveSeason]
    );
    return result.rows;
  });
}
