export default async function upsertGame(client, league, gamePayload) {
  const text = `
    INSERT INTO games
      (eventid, date, hometeamid, awayteamid, league,
       homescore, awayscore, venue, broadcast,
       firstqtr, secondqtr, thirdqtr, fourthqtr,
       ot1, ot2, ot3, ot4,
       status, season, game_label, current_period, clock, start_time)
    VALUES
      ($1,      $2,   $3,         $4,          $5,
       $6,       $7,         $8,          $9,
       $10,      $11,        $12,         $13,
       $14,      $15,        $16,         $17,
       $18,      $19,        $20,          $21,    $22,  $23)
    ON CONFLICT (eventid, league) DO UPDATE
      SET date           = EXCLUDED.date,
          hometeamid     = EXCLUDED.hometeamid,
          awayteamid     = EXCLUDED.awayteamid,
          homescore      = EXCLUDED.homescore,
          awayscore      = EXCLUDED.awayscore,
          venue          = EXCLUDED.venue,
          broadcast      = EXCLUDED.broadcast,
          firstqtr       = EXCLUDED.firstqtr,
          secondqtr      = EXCLUDED.secondqtr,
          thirdqtr       = EXCLUDED.thirdqtr,
          fourthqtr      = EXCLUDED.fourthqtr,
          ot1            = EXCLUDED.ot1,
          ot2            = EXCLUDED.ot2,
          ot3            = EXCLUDED.ot3,
          ot4            = EXCLUDED.ot4,
          status         = EXCLUDED.status,
          season         = EXCLUDED.season,
          game_label     = EXCLUDED.game_label,
          current_period = EXCLUDED.current_period,
          clock          = EXCLUDED.clock,
          start_time     = EXCLUDED.start_time
          RETURNING id;
  `;

  const values = [
    gamePayload.eventid,          // ESPN event ID
    gamePayload.date,             // e.g. '2025-05-30'
    gamePayload.homeTeamId,
    gamePayload.awayTeamId,
    league,                       // 'nba', 'nfl', etc.
    gamePayload.homeScore,
    gamePayload.awayScore,
    gamePayload.venue,
    gamePayload.broadcast,
    gamePayload.quarters.first || null,
    gamePayload.quarters.second || null,
    gamePayload.quarters.third || null,
    gamePayload.quarters.fourth || null,
    gamePayload.quarters.ot1 || null,
    gamePayload.quarters.ot2 || null,
    gamePayload.quarters.ot3 || null,
    gamePayload.quarters.ot4 || null,
    gamePayload.status,           // 'SCHEDULED' / 'IN' / 'FINAL'
    gamePayload.seasonText,       // '2024-25' etc.
    gamePayload.gameLabel || null,
    gamePayload.currentPeriod ?? null,
    gamePayload.clock ?? null,
    gamePayload.startTime ?? null,
  ];
  const result = await client.query(text, values);
  const gameId = result.rows[0].id;

  await client.query(
    `
  UPDATE games
  SET winnerid = CASE
    WHEN homescore > awayscore THEN hometeamid
    WHEN awayscore > homescore THEN awayteamid
    ELSE NULL
  END
  WHERE id = $1
`,
    [gameId]
  );
  return gameId;
}
