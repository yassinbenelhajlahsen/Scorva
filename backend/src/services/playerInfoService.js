import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";

async function playerTTL(league, season) {
  const currentSeason = await getCurrentSeason(league);
  return season === currentSeason ? 120 : 30 * 86400; // 2 min current, 30 days past
}

export async function getNbaPlayer(playerId, season) {
  const ttl = await playerTTL("nba", season);
  return cached(`playerDetail:nba:${playerId}:${season}`, ttl, async () => {
    const result = await pool.query(
      `
    SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'position', p.position,
      'jerseyNumber', p.jerseynum,
      'height', p.height,
      'weight', p.weight,
      'dob', p.dob,
      'draftInfo', p.draftinfo,
      'imageUrl', p.image_url,
      'espnId', p.espn_playerid,
      'season', $3,
      'team', json_build_object(
        'id', t.id,
        'name', t.name,
        'shortName', t.shortname,
        'location', t.location,
        'logoUrl', t.logo_url
      ),
      'seasonAverages', json_build_object(
        'points', COALESCE(ROUND(AVG(s.points) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'assists', COALESCE(ROUND(AVG(s.assists) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'rebounds', COALESCE(ROUND(AVG(s.rebounds) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'fgPct',
          COALESCE(
            ROUND(
              100.0 *
              COALESCE(SUM((split_part(s.fg, '-', 1))::NUMERIC) FILTER (WHERE g2.id IS NOT NULL), 0)
              /
              NULLIF(
                COALESCE(SUM((split_part(s.fg, '-', 2))::NUMERIC) FILTER (WHERE g2.id IS NOT NULL), 0),
                0
              ),
              1
            ),
            0
          )
      ),
      'games',
        COALESCE((
          SELECT json_agg(game_data ORDER BY game_data.date DESC)
          FROM (
            SELECT
              g.date,
              g.status,
              s2.gameid,
              s2.points,
              s2.assists,
              s2.rebounds,
              s2.blocks,
              s2.steals,
              s2.fg,
              s2.threept,
              s2.ft,
              s2.turnovers,
              s2.plusminus,
              s2.minutes,
              CASE WHEN g.hometeamid = p.teamid THEN at.shortname ELSE ht.shortname END AS opponent,
              CASE WHEN g.hometeamid = p.teamid THEN at.logo_url ELSE ht.logo_url END AS opponentLogo,
              CASE WHEN g.hometeamid = p.teamid THEN true ELSE false END AS isHome,
              CASE
                WHEN g.winnerid IS NULL THEN NULL
                WHEN g.winnerid = p.teamid THEN 'W'
                ELSE 'L'
              END AS result
            FROM stats s2
            JOIN games g    ON s2.gameid = g.id
            JOIN teams ht   ON g.hometeamid = ht.id
            JOIN teams at   ON g.awayteamid = at.id
            WHERE s2.playerid = p.id AND g.season = $3 AND g.type = 'regular'
            ORDER BY g.date DESC
            LIMIT 12
          ) AS game_data
        ), '[]'::json)
    ) AS player
    FROM players p
    JOIN teams t ON p.teamid = t.id
    LEFT JOIN stats s ON p.id = s.playerid
    LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3 AND g2.type = 'regular'
    WHERE p.league = $1 AND p.id = $2
    GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
    `,
      ["nba", playerId, season]
    );
    return result.rows[0] ?? null;
  });
}

export async function getNflPlayer(playerId, season) {
  const ttl = await playerTTL("nfl", season);
  return cached(`playerDetail:nfl:${playerId}:${season}`, ttl, async () => {
    const result = await pool.query(
      `
    SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'position', p.position,
      'jerseyNumber', p.jerseynum,
      'height', p.height,
      'weight', p.weight,
      'dob', p.dob,
      'draftInfo', p.draftinfo,
      'imageUrl', p.image_url,
      'espnId', p.espn_playerid,
      'season', $3,
      'team', json_build_object(
        'id', t.id,
        'name', t.name,
        'shortName', t.shortname,
        'location', t.location,
        'logoUrl', t.logo_url
      ),
      'seasonAverages', json_build_object(
        'yards',         COALESCE(ROUND(AVG(s.yds)           FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'td',            COALESCE(ROUND(AVG(s.td)            FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'interceptions', COALESCE(ROUND(AVG(s.interceptions) FILTER (WHERE g2.id IS NOT NULL), 1), 0)
      ),
      'games',
        COALESCE((
          SELECT json_agg(game_data ORDER BY game_data.date DESC)
          FROM (
            SELECT
              g.date,
              g.status,
              s2.gameid,
              s2.cmpatt AS "CMPATT",
              s2.yds    AS "YDS",
              s2.sacks  AS "SACK",
              s2.td     AS "TD",
              s2.interceptions AS "INT",
              CASE WHEN g.hometeamid = p.teamid THEN at.shortname ELSE ht.shortname END AS opponent,
              CASE WHEN g.hometeamid = p.teamid THEN at.logo_url ELSE ht.logo_url END AS opponentLogo,
              CASE WHEN g.hometeamid = p.teamid THEN true ELSE false END AS isHome,
              CASE
                WHEN g.winnerid IS NULL THEN NULL
                WHEN g.winnerid = p.teamid THEN 'W'
                ELSE 'L'
              END AS result
            FROM stats s2
            JOIN games g    ON s2.gameid = g.id
            JOIN teams ht   ON g.hometeamid = ht.id
            JOIN teams at   ON g.awayteamid = at.id
            WHERE s2.playerid = p.id AND g.season = $3 AND g.type = 'regular'
            ORDER BY g.date DESC
            LIMIT 12
          ) AS game_data
        ), '[]'::json)
    ) AS player
    FROM players p
    JOIN teams t ON p.teamid = t.id
    LEFT JOIN stats s ON p.id = s.playerid
    LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3 AND g2.type = 'regular'
    WHERE p.league = $1 AND p.id = $2
    GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
    `,
      ["nfl", playerId, season]
    );
    return result.rows[0] ?? null;
  });
}

export async function getNhlPlayer(playerId, season) {
  const ttl = await playerTTL("nhl", season);
  return cached(`playerDetail:nhl:${playerId}:${season}`, ttl, async () => {
    const result = await pool.query(
      `
    SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'position', p.position,
      'jerseyNumber', p.jerseynum,
      'height', p.height,
      'weight', p.weight,
      'dob', p.dob,
      'draftInfo', p.draftinfo,
      'imageUrl', p.image_url,
      'espnId', p.espn_playerid,
      'season', $3,
      'team', json_build_object(
        'id', t.id,
        'name', t.name,
        'shortName', t.shortname,
        'location', t.location,
        'logoUrl', t.logo_url
      ),
      'seasonAverages', json_build_object(
        'goals',  COALESCE(ROUND(AVG(s.g)     FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'assists',COALESCE(ROUND(AVG(s.a)     FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'saves',  COALESCE(ROUND(AVG(s.saves) FILTER (WHERE g2.id IS NOT NULL), 1), 0),
        'shots',  COALESCE(ROUND(AVG(s.shots) FILTER (WHERE g2.id IS NOT NULL), 1), 0)
      ),
      'games',
        COALESCE((
          SELECT json_agg(game_data ORDER BY game_data.date DESC)
          FROM (
            SELECT
              g.date,
              g.status,
              s2.gameid,
              s2.g       AS "G",
              s2.a       AS "A",
              s2.saves   AS "SAVES",
              s2.savepct AS "SPCT",
              s2.ga      AS "GA",
              s2.toi     AS "TOI",
              s2.shots   AS "SHOTS",
              s2.sm      AS "SM",
              s2.bs      AS "BS",
              s2.pn      AS "PN",
              s2.pim     AS "PIM",
              s2.ht      AS "HT",
              s2.tk      AS "TK",
              s2.gv      AS "GV",
              s2.plusminus AS "plusminus",
              CASE WHEN g.hometeamid = p.teamid THEN at.shortname ELSE ht.shortname END AS opponent,
              CASE WHEN g.hometeamid = p.teamid THEN at.logo_url ELSE ht.logo_url END AS opponentLogo,
              CASE WHEN g.hometeamid = p.teamid THEN true ELSE false END AS isHome,
              CASE
                WHEN g.winnerid IS NULL THEN NULL
                WHEN g.winnerid = p.teamid THEN 'W'
                ELSE 'L'
              END AS result
            FROM stats s2
            JOIN games g    ON s2.gameid = g.id
            JOIN teams ht   ON g.hometeamid = ht.id
            JOIN teams at   ON g.awayteamid = at.id
            WHERE s2.playerid = p.id AND g.season = $3 AND g.type = 'regular'
            ORDER BY g.date DESC
            LIMIT 12
          ) AS game_data
        ), '[]'::json)
    ) AS player
    FROM players p
    JOIN teams t ON p.teamid = t.id
    LEFT JOIN stats s ON p.id = s.playerid
    LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3 AND g2.type = 'regular'
    WHERE p.league = $1 AND p.id = $2
    GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
    `,
      ["nhl", playerId, season]
    );
    return result.rows[0] ?? null;
  });
}
