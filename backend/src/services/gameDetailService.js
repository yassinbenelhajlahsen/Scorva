import pool from "../db/db.js";
import { cached } from "../cache/cache.js";

const GAME_DETAIL_TTL = 30 * 86400; // 30 days

export async function getNbaGame(gameId) {
  return cached(
    `gameDetail:nba:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
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
    'winnerId', g.winnerid,
    'gameLabel', g.game_label,
    'gameType', g.type,
    'currentPeriod', g.current_period,
    'clock', g.clock,
    'startTime', g.start_time,
    'eventId', g.eventid,
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id)
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
      'conference', ht.conf,
      'color', ht.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.hometeamid
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
      'conference', at.conf,
      'color', at.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2;`,
        [gameId, "nba"]
      );
      return result.rows[0] ?? null;
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export async function getNflGame(gameId) {
  return cached(
    `gameDetail:nfl:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
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
    'winnerId', g.winnerid,
    'gameLabel', g.game_label,
    'gameType', g.type,
    'currentPeriod', g.current_period,
    'clock', g.clock,
    'startTime', g.start_time,
    'eventId', g.eventid,
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id)
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
      'conference', ht.conf,
      'color', ht.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.hometeamid
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
      'conference', at.conf,
      'color', at.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2`,
        [gameId, "nfl"]
      );
      return result.rows[0] ?? null;
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export async function getNhlGame(gameId) {
  return cached(
    `gameDetail:nhl:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
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
    'winnerId', g.winnerid,
    'gameLabel', g.game_label,
    'gameType', g.type,
    'currentPeriod', g.current_period,
    'clock', g.clock,
    'startTime', g.start_time,
    'eventId', g.eventid,
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id)
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
      'conference', ht.conf,
      'color', ht.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.hometeamid
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
      'conference', at.conf,
      'color', at.primary_color
    ),
    'players', (
      SELECT COALESCE(json_agg(json_build_object(
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
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = g.awayteamid
    )
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
WHERE g.id = $1 AND g.league = $2;
    `,
        [gameId, "nhl"]
      );
      return result.rows[0] ?? null;
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}
