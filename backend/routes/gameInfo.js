import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/:league/games/:gameId', async (req, res) => {
  const { league } = req.params;

  switch (league.toLowerCase()) {
    case 'nba':
      return handleNbaGame(req, res);
    case 'nfl':
      return handleNflGame(req, res); 
    case 'nhl':
      return handleNhlGame(req, res); 
    default:
      return res.status(400).send("Invalid league");
  }
});

async function handleNbaGame(req, res) {
  const { gameId } = req.params;
  try {
    const result = await pool.query(
      `SELECT json_build_object(
  'game', json_build_object(
    'id', g.id,
    'league', g.league,
    'date', g.date,
    'venue', g.venue,
    'broadcast', g.broadcast,
    'score', json_build_object(
      'home', g.homescore,
      'away', g.awayscore,
      'quarters', json_build_object(
        'q1', g.firstqtr,
        'q2', g.secondqtr,
        'q3', g.thirdqtr,
        'q4', g.fourthqtr,
        'ot', ARRAY[g.ot1, g.ot2, g.ot3, g.ot4]
      )
    ),
    'status', g.status,
    'season', g.season,
    'winnerId', g.winnerid
  ),
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'shortName', ht.shortname,
      'location', ht.location,
      'logoUrl', ht.logo_url,
      'record', ht.record,
      'homeRecord', ht.homerecord,
      'awayRecord', ht.awayrecord,
      'conference', ht.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
          'PTS', s.points,
          'AST', s.assists,
          'REB', s.rebounds,
          'BLK', s.blocks,
          'STL', s.steals,
          'PF', s.fouls,
          'MIN', s.minutes,
          'TO', s.turnovers,
          '+/-', s.plusminus,
        'FG', s.fg,
            '3PT', s.threept,
            'FT', s.ft
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.hometeamid
    )
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'shortName', at.shortname,
      'location', at.location,
      'logoUrl', at.logo_url,
      'record', at.record,
      'homeRecord', at.homerecord,
      'awayRecord', at.awayrecord,
      'conference', at.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
         'PTS', s.points,
          'AST', s.assists,
          'REB', s.rebounds,
          'BLK', s.blocks,
          'STL', s.steals,
          'PF', s.fouls,
          'MIN', s.minutes,
          'TO', s.turnovers,
          '+/-', s.plusminus,
            'FG', s.fg,
            '3PT', s.threept,
            'FT', s.ft
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2;`,
      [gameId, 'nba']
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Game not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ NBA game fetch error:", err);
    res.status(500).send("Server error");
  }
}

async function handleNhlGame(req, res) {
  const { gameId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT json_build_object(
  'game', json_build_object(
    'id', g.id,
    'league', g.league,
    'date', g.date,
    'venue', g.venue,
    'broadcast', g.broadcast,
    'score', json_build_object(
      'home', g.homescore,
      'away', g.awayscore,
      'quarters', json_build_object(
        'q1', g.firstqtr,
        'q2', g.secondqtr,
        'q3', g.thirdqtr,
        'q4', g.fourthqtr,
        'ot', ARRAY[g.ot1, g.ot2, g.ot3, g.ot4]
      )
    ),
    'status', g.status,
    'season', g.season,
    'winnerId', g.winnerid
  ),
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'shortName', ht.shortname,
      'location', ht.location,
      'logoUrl', ht.logo_url,
      'record', ht.record,
      'homeRecord', ht.homerecord,
      'awayRecord', ht.awayrecord,
      'conference', ht.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
            'G', s.g,
            'A', s.a,
            'SAVES', s.saves,
            'SPCT', s.savepct, 
            'GA', s.ga,
            'TOI', s.toi,
            'SHOTS', s.shots,
            'SM', s.sm,
            'BS', s.bs,
            'PN', s.pn,
            'PIM', s.pim,
            'HT', s.ht,
            'TK', s.tk,
            'GV', s.gv
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.hometeamid
    )
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'shortName', at.shortname,
      'location', at.location,
      'logoUrl', at.logo_url,
      'record', at.record,
      'homeRecord', at.homerecord,
      'awayRecord', at.awayrecord,
      'conference', at.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
            'G', s.g,
            'A', s.a,
            'SAVES', s.saves,
            'SPCT', s.savepct, 
            'GA', s.ga,
            'TOI', s.toi,
            'SHOTS', s.shots,
            'SM', s.sm,
            'BS', s.bs,
            'PN', s.pn,
            'PIM', s.pim,
            'HT', s.ht,
            'TK', s.tk,
            'GV', s.gv
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2;
    `,
      [gameId, 'nhl']
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Game not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ NHL game fetch error:", err);
    res.status(500).send("Server error");
  }
}

async function handleNflGame(req, res) {
  const { gameId } = req.params;

  try {
    const result = await pool.query(
      `SELECT json_build_object(
  'game', json_build_object(
    'id', g.id,
    'league', g.league,
    'date', g.date,
    'venue', g.venue,
    'broadcast', g.broadcast,
    'score', json_build_object(
      'home', g.homescore,
      'away', g.awayscore,
      'quarters', json_build_object(
        'q1', g.firstqtr,
        'q2', g.secondqtr,
        'q3', g.thirdqtr,
        'q4', g.fourthqtr,
        'ot', ARRAY[g.ot1, g.ot2, g.ot3, g.ot4]
      )
    ),
    'status', g.status,
    'season', g.season,
    'winnerId', g.winnerid
  ),
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'shortName', ht.shortname,
      'location', ht.location,
      'logoUrl', ht.logo_url,
      'record', ht.record,
      'homeRecord', ht.homerecord,
      'awayRecord', ht.awayrecord,
      'conference', ht.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
          'CMPATT', s.cmpatt,
            'YDS', s.yds,
            'SCKS', s.sacks,
            'TD', s.td,
            'INT', s.interceptions
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.hometeamid
    )
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'shortName', at.shortname,
      'location', at.location,
      'logoUrl', at.logo_url,
      'record', at.record,
      'homeRecord', at.homerecord,
      'awayRecord', at.awayrecord,
      'conference', at.conf
    ),
    'players', (
      SELECT json_agg(json_build_object(
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
        'stats', json_build_object(
            'CMPATT', s.cmpatt,
            'YDS', s.yds,
            'SCKS', s.sacks,
            'TD', s.td,
            'INT', s.interceptions
        )
      ))
      FROM stats s
      JOIN players p ON p.id = s.playerid
WHERE s.gameid = g.id AND p.teamid = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2`,
      [gameId, 'nfl']
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Game not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ NFL game fetch error:", err);
    res.status(500).send("Server error");
  }
}

export default router;