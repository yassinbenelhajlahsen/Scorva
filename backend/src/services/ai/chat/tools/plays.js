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

  const [playsResult, statusResult] = await Promise.all([
    pool.query(
      `SELECT p.id AS play_id, p.sequence, p.period, p.clock, p.description,
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
    ),
    singleGame
      ? pool.query(
          `SELECT status FROM games WHERE id = $1 AND league = $2`,
          [gameId, league],
        )
      : Promise.resolve(null),
  ]);

  const { rows } = playsResult;

  // Per-play participant ratings (NBA only — play_ratings is NBA-only).
  // Fetch in a second query keyed by play_id so the main query stays simple.
  // Cap at 50 since safeLimit ≤ 50; this is bounded.
  let ratingsByPlay = new Map();
  if (league === "nba" && rows.length > 0) {
    const playIds = rows.map((r) => r.play_id).filter((id) => id != null);
    if (playIds.length > 0) {
      const { rows: rateRows } = await pool.query(
        `SELECT pr.play_id, pr.role, pr.weighted_value, pr.wpa_delta,
                p.id AS player_id, p.name AS player_name
           FROM play_ratings pr
           JOIN players p ON p.id = pr.player_id
          WHERE pr.play_id = ANY($1::int[])`,
        [playIds],
      );
      for (const r of rateRows) {
        if (!ratingsByPlay.has(r.play_id)) ratingsByPlay.set(r.play_id, []);
        ratingsByPlay.get(r.play_id).push({
          player: r.player_name,
          role: r.role,
          weightedValue:
            r.weighted_value == null ? null : Math.round(Number(r.weighted_value) * 10) / 10,
          wpaDelta:
            r.wpa_delta == null ? null : Math.round(Number(r.wpa_delta) * 10000) / 10000,
        });
      }
      // Sort each play's contributors by absolute weighted_value DESC so the
      // most impactful contribution is first.
      for (const arr of ratingsByPlay.values()) {
        arr.sort(
          (a, b) =>
            Math.abs(b.weightedValue ?? 0) - Math.abs(a.weightedValue ?? 0),
        );
      }
    }
  }

  let retention;
  if (!singleGame) {
    retention = "scoring_only";
  } else {
    const status = statusResult?.rows[0]?.status;
    retention = status && /^Final/i.test(status) ? "scoring_only" : "all";
  }

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

    // NBA per-play rating breakdown — list of contributors with weighted_value
    // (display-scaled ±10) and wpa_delta. Useful for "biggest plays" or
    // "who was the most impactful on this possession" questions.
    const ratings = ratingsByPlay.get(r.play_id);
    if (ratings && ratings.length > 0) {
      play.ratings = ratings;
    }

    return play;
  });

  return { plays, capped: plays.length === safeLimit, retention };
}
