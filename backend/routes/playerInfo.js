import express from "express";
import pool from "../db.js";

const router = express.Router();

// Change this when a new season starts
const currentSeason = "2025-2026";

/**
 * Resolve ":slug" (or numeric string) to a numeric player id for a given league.
 * - If slugOrId is numeric, return it.
 * - Else look up players.slug (or a derived slug from name).
 */
async function getPlayerIdBySlug(slugOrId, league) {
  try {
    const s = String(slugOrId).trim();

    // Already numeric? Use it directly.
    if (/^\d+$/.test(s)) return parseInt(s, 10);

    // Try exact slug column
    const bySlug = await pool.query(
      `SELECT id FROM players WHERE league = $1 AND slug = $2 LIMIT 1`,
      [league, s]
    );
    if (bySlug.rows[0]?.id) return bySlug.rows[0].id;

    // Fallback: derive slug from name if slug column wasn't populated
    const byNameSlug = await pool.query(
      `SELECT id
         FROM players
        WHERE league = $1
          AND LOWER(REPLACE(name, ' ', '-')) = $2
        LIMIT 1`,
      [league, s.toLowerCase()]
    );
    return byNameSlug.rows[0]?.id ?? null;
  } catch (err) {
    console.error("Error looking up player by slug:", err);
    return null;
  }
}

router.get("/:league/players/:slug", async (req, res) => {
  const league = String(req.params.league || "").toLowerCase();
  switch (league) {
    case "nba":
      return handleNbaPlayer(req, res, league);
    case "nfl":
      return handleNflPlayer(req, res, league);
    case "nhl":
      return handleNhlPlayer(req, res, league);
    default:
      return res.status(400).json({ error: "Invalid league" });
  }
});

export default router;

/* ------------------------------ NBA ------------------------------ */

async function handleNbaPlayer(req, res, league) {
  const { slug } = req.params;

  try {
    const playerId = await getPlayerIdBySlug(slug, league);
    if (!playerId) {
      return res.status(404).json({ error: "Player not und" });
    }
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
              WHERE s2.playerid = p.id
              ORDER BY g.date DESC
              LIMIT 12
            ) AS game_data
          ), '[]'::json)
      ) AS player
      FROM players p
      JOIN teams t ON p.teamid = t.id
      LEFT JOIN stats s ON p.id = s.playerid
      LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3
      WHERE p.league = $1 AND p.id = $2
      GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
      `,
      [league, playerId, currentSeason]
    );

    // With LEFT JOIN, we should always get 1 row if the player exists.
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching NBA player:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/* ------------------------------ NFL ------------------------------ */

async function handleNflPlayer(req, res, league) {
  const { slug } = req.params;

  try {
    const playerId = await getPlayerIdBySlug(slug, league);
    if (!playerId) {
      return res.status(404).json({ error: "Player not found" });
    }

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
                s2.gameid,
                s2.cmpatt AS "CMPATT",
                s2.yds    AS "YDS",
                s2.sacks  AS "SCKS",
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
              WHERE s2.playerid = p.id
              ORDER BY g.date DESC
              LIMIT 12
            ) AS game_data
          ), '[]'::json)
      ) AS player
      FROM players p
      JOIN teams t ON p.teamid = t.id
      LEFT JOIN stats s ON p.id = s.playerid
      LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3
      WHERE p.league = $1 AND p.id = $2
      GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
      `,
      [league, playerId, currentSeason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching NFL player:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/* ------------------------------ NHL ------------------------------ */

async function handleNhlPlayer(req, res, league) {
  const { slug } = req.params;

  try {
    const playerId = await getPlayerIdBySlug(slug, league);
    if (!playerId) {
      return res.status(404).json({ error: "Player not found" });
    }

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
              WHERE s2.playerid = p.id
              ORDER BY g.date DESC
              LIMIT 12
            ) AS game_data
          ), '[]'::json)
      ) AS player
      FROM players p
      JOIN teams t ON p.teamid = t.id
      LEFT JOIN stats s ON p.id = s.playerid
      LEFT JOIN games g2 ON s.gameid = g2.id AND g2.season = $3
      WHERE p.league = $1 AND p.id = $2
      GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
      `,
      [league, playerId, currentSeason]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching NHL player:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
