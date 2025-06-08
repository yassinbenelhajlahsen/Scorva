import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/:league/players/:playerId", async (req, res) => {
  const { league } = req.params;

  switch (league.toLowerCase()) {
    case "nba":
      return handleNbaPlayer(req, res);
    case "nfl":
      return handleNflPlayer(req, res);
    case "nhl":
      return handleNhlPlayer(req, res);
    default:
      return res.status(400).send("Invalid league");
  }
});

export default router;

async function handleNbaPlayer(req, res) {
  const { playerId } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
  json_build_object(
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
      'points', ROUND(AVG(s.points), 1),
      'assists', ROUND(AVG(s.assists), 1),
      'rebounds', ROUND(AVG(s.rebounds), 1),
      'fgPct', ROUND(
        100.0 * 
        SUM(SPLIT_PART(s.fg, '-', 1)::NUMERIC) /
        NULLIF(SUM(SPLIT_PART(s.fg, '-', 2)::NUMERIC), 0),
        1
      )
    ),
    'games', (
      SELECT json_agg(game_data ORDER BY game_data.date DESC)
      FROM (
        SELECT 
          g.date,
          s.gameid,
          s.points,
          s.assists,
          s.rebounds,
          s.blocks,
          s.steals,
          s.fg,
          s.threept,
          s.ft,
          s.turnovers,
          s.plusminus,
          s.minutes,
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.shortname
            ELSE ht.shortname
          END AS opponent,
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.logo_url
            ELSE ht.logo_url
          END AS opponentLogo,
          CASE 
            WHEN g.hometeamid = p.teamid THEN true
            ELSE false
          END AS isHome,
          CASE
            WHEN g.winnerid IS NULL THEN NULL
            WHEN g.winnerid = p.teamid THEN 'W'
            ELSE 'L'
          END AS result
        FROM stats s
        JOIN games g ON s.gameid = g.id
        JOIN teams ht ON g.hometeamid = ht.id
        JOIN teams at ON g.awayteamid = at.id
        WHERE s.playerid = p.id
        ORDER BY g.date DESC
        LIMIT 12
      ) AS game_data
    )
  ) AS player
FROM players p
JOIN stats s ON p.id = s.playerid
JOIN teams t ON p.teamid = t.id
WHERE p.league = $1 AND p.id = $2
GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;
`,
      ["nba", playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Player not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching player with games:", err);
    res.status(500).send("Server error");
  }
}


async function handleNflPlayer(req, res) {
  const { playerId } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
  json_build_object(
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
      'yards', ROUND(AVG(s.yds), 1),
      'td', ROUND(AVG(s.td), 1),
      'interceptions', ROUND(AVG(s.interceptions), 1)
    ),
    'games', (
      SELECT json_agg(game_data ORDER BY game_data.date DESC)
      FROM (
        SELECT 
          g.date,
          s.gameid,
          s.cmpatt AS "CMPATT",
          s.yds AS "YDS",
          s.sacks AS "SCKS",
          s.td AS "TD",
          s.interceptions AS "INT",
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.shortname
            ELSE ht.shortname
          END AS opponent,
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.logo_url
            ELSE ht.logo_url
          END AS opponentLogo,
          CASE 
            WHEN g.hometeamid = p.teamid THEN true
            ELSE false
          END AS isHome,
          CASE
            WHEN g.winnerid IS NULL THEN NULL
            WHEN g.winnerid = p.teamid THEN 'W'
            ELSE 'L'
          END AS result
        FROM stats s
        JOIN games g ON s.gameid = g.id
        JOIN teams ht ON g.hometeamid = ht.id
        JOIN teams at ON g.awayteamid = at.id
        WHERE s.playerid = p.id
        ORDER BY g.date DESC
        LIMIT 12
      ) AS game_data
    )
  ) AS player
FROM players p
JOIN stats s ON p.id = s.playerid
JOIN teams t ON p.teamid = t.id
WHERE p.league = $1 AND p.id = $2
GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;`
,
      ["nfl", playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Player not found");
    }

    res.json(result.rows[0]); 
  } catch (err) {
    console.error("Error fetching player with games:", err);
    res.status(500).send("Server error");
  }
}
async function handleNhlPlayer(req, res) {
  const { playerId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
  json_build_object(
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
      'goals', ROUND(AVG(s.g), 1),
      'assists', ROUND(AVG(s.a), 1),
      'saves', ROUND(AVG(s.saves), 1),
      'shots', ROUND(AVG(s.shots), 1)
    ),
    'games', (
      SELECT json_agg(game_data ORDER BY game_data.date DESC)
      FROM (
        SELECT 
          g.date,
          s.gameid,
          s.g AS "G",
          s.a AS "A",
          s.saves AS "SAVES",
          s.savepct AS "SPCT",
          s.ga AS "GA",
          s.toi AS "TOI",
          s.shots AS "SHOTS",
          s.sm AS "SM",
          s.bs AS "BS",
          s.pn AS "PN",
          s.pim AS "PIM",
          s.ht AS "HT",
          s.tk AS "TK",
          s.gv AS "GV",
          s.plusminus AS "plusminus",
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.shortname
            ELSE ht.shortname
          END AS opponent,
          CASE 
            WHEN g.hometeamid = p.teamid THEN at.logo_url
            ELSE ht.logo_url
          END AS opponentLogo,
          CASE 
            WHEN g.hometeamid = p.teamid THEN true
            ELSE false
          END AS isHome,
          CASE
            WHEN g.winnerid IS NULL THEN NULL
            WHEN g.winnerid = p.teamid THEN 'W'
            ELSE 'L'
          END AS result
        FROM stats s
        JOIN games g ON s.gameid = g.id
        JOIN teams ht ON g.hometeamid = ht.id
        JOIN teams at ON g.awayteamid = at.id
        WHERE s.playerid = p.id
        ORDER BY g.date DESC
        LIMIT 12
      ) AS game_data
    )
  ) AS player
FROM players p
JOIN stats s ON p.id = s.playerid
JOIN teams t ON p.teamid = t.id
WHERE p.league = $1 AND p.id = $2
GROUP BY p.id, t.id, t.name, t.shortname, t.location, t.logo_url;`,
      ["nhl", playerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Player not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching player with games:", err);
    res.status(500).send("Server error");
  }
}
