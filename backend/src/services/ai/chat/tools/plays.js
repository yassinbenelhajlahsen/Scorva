import pool from "../../../../db/db.js";

export async function getPlaysForAgent(args) {
  const {
    league,
    gameId,
    playerName,
    teamId,
    period,
    scoringOnly,
    playType,
    searchText,
    season,
    limit,
  } = args;

  const parsed = parseInt(limit);
  const safeLimit = Math.min(Math.max(1, isNaN(parsed) ? 30 : parsed), 50);
  const singleGame = gameId != null;

  // For NFL, include drive metadata columns
  const driveColumns =
    league === "nfl"
      ? ", p.drive_number, p.drive_description, p.drive_result"
      : "";

  const { rows } = await pool.query(
    `SELECT p.sequence, p.period, p.clock, p.description,
            p.home_score, p.away_score, p.scoring_play, p.play_type,
            t.shortname AS team,
            g.id AS game_id, g.date,
            ht.shortname AS home_team, at.shortname AS away_team
            ${driveColumns}
     FROM plays p
     JOIN games g ON g.id = p.gameid
     LEFT JOIN teams t ON t.id = p.team_id
     JOIN teams ht ON ht.id = g.hometeamid
     JOIN teams at ON at.id = g.awayteamid
     WHERE g.league = $1
       AND ($2::int IS NULL OR p.gameid = $2)
       AND ($3::text IS NULL OR p.description ILIKE '%' || $3 || '%')
       AND ($4::int IS NULL OR p.team_id = $4)
       AND ($5::int IS NULL OR p.period = $5)
       AND ($6::boolean IS NULL OR p.scoring_play = $6)
       AND ($7::text IS NULL OR p.play_type ILIKE '%' || $7 || '%')
       AND ($8::text IS NULL OR p.description ILIKE '%' || $8 || '%')
       AND g.season = $9
       AND ($2::int IS NOT NULL OR g.status ILIKE 'Final%')
     ORDER BY g.date ASC, p.sequence ASC
     LIMIT $10`,
    [
      league,
      gameId ?? null,
      playerName ?? null,
      teamId ?? null,
      period ?? null,
      scoringOnly ?? null,
      playType ?? null,
      searchText ?? null,
      season,
      safeLimit,
    ],
  );

  const plays = rows.map((r) => {
    const play = {
      description: r.description,
      period: r.period,
      clock: r.clock,
      home_score: r.home_score,
      away_score: r.away_score,
      scoring_play: r.scoring_play,
      play_type: r.play_type,
      team: r.team,
    };

    // For cross-game queries include game context so LLM can attribute each play
    if (!singleGame) {
      play.game_id = r.game_id;
      play.game_date = r.date;
      play.matchup = `${r.away_team} vs ${r.home_team}`;
    }

    // NFL drive metadata
    if (league === "nfl") {
      play.drive_number = r.drive_number;
      play.drive_description = r.drive_description;
      play.drive_result = r.drive_result;
    }

    return play;
  });

  return { plays, capped: plays.length === safeLimit };
}
