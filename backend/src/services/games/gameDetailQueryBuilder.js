// League-specific stat column SQL fragments for json_build_object
const STAT_COLUMNS_SQL = {
  nba: `
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
          'FT', s.ft`,
  nfl: `
          'CMPATT', s.cmpatt,
          'YDS', s.yds,
          'SCKS', s.sacks,
          'TD', s.td,
          'INT', s.interceptions`,
  nhl: `
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
          'GV', s.gv`,
};

export function buildGameDetailSQL(league) {
  const statCols = STAT_COLUMNS_SQL[league];
  if (!statCols) throw new Error(`Unknown league: ${league}`);

  const playerSubquery = (teamIdCol) => `
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
        'stats', json_build_object(${statCols}
        )
      )), '[]'::json)
      FROM stats s
      JOIN players p ON p.id = s.playerid
      WHERE s.gameid = g.id AND COALESCE(s.teamid, p.teamid) = ${teamIdCol}`;

  return `
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
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id),
    'seriesScore', json_build_object(
      'homeWins', COALESCE(sc.home_series_wins, 0),
      'awayWins', COALESCE(sc.away_series_wins, 0)
    )
  ),
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'abbreviation', ht.abbreviation,
      'shortName', ht.shortname,
      'location', ht.location,
      'logoUrl', ht.logo_url,
      'record', ht.record,
      'homeRecord', ht.homerecord,
      'awayRecord', ht.awayrecord,
      'conference', ht.conf,
      'color', ht.primary_color
    ),
    'players', (${playerSubquery("g.hometeamid")})
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'abbreviation', at.abbreviation,
      'shortName', at.shortname,
      'location', at.location,
      'logoUrl', at.logo_url,
      'record', at.record,
      'homeRecord', at.homerecord,
      'awayRecord', at.awayrecord,
      'conference', at.conf,
      'color', at.primary_color
    ),
    'players', (${playerSubquery("g.awayteamid")})
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE g2.winnerid = g.hometeamid) AS home_series_wins,
    COUNT(*) FILTER (WHERE g2.winnerid = g.awayteamid) AS away_series_wins
  FROM games g2
  WHERE g.league IN ('nba', 'nhl')
    AND g.type IN ('playoff', 'final')
    AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
    AND g2.league = g.league
    AND g2.season = g.season
    AND g2.type IN ('playoff', 'final')
    AND g2.status ILIKE 'Final%'
    AND g2.id <= g.id
    AND (
      (g2.hometeamid = g.hometeamid AND g2.awayteamid = g.awayteamid) OR
      (g2.hometeamid = g.awayteamid AND g2.awayteamid = g.hometeamid)
    )
) sc ON true
WHERE g.id = $1 AND g.league = $2`;
}
