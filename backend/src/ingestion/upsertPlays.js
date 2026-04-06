/**
 * Extracts play-by-play data from an ESPN summary response and bulk-upserts
 * into the plays table.
 *
 * For NBA/NHL: reads summaryData.plays[]
 * For NFL: reads summaryData.drives.previous[] + summaryData.drives.current,
 *          flattening nested drive.plays[] with drive metadata denormalized.
 */
export default async function upsertPlays(
  client,
  gameId,
  summaryData,
  league,
  homeTeamId,
  awayTeamId,
  homeEspnId,
  awayEspnId,
) {
  const rawRows = league === "nfl"
    ? extractNflPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId)
    : extractPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId);

  // Deduplicate by sequence — ESPN occasionally emits duplicate sequenceNumbers;
  // keep the last occurrence to match ESPN's own ordering.
  const seenSeq = new Map();
  for (const row of rawRows) seenSeq.set(row.sequence, row);
  const rows = Array.from(seenSeq.values());

  if (rows.length === 0) return;

  // Bulk upsert via unnest — single round trip regardless of row count
  await client.query(
    `INSERT INTO plays (
       gameid, espn_play_id, sequence, period, clock,
       description, short_text, home_score, away_score,
       scoring_play, team_id, play_type,
       drive_number, drive_description, drive_result
     )
     SELECT
       $1,
       unnest($2::text[]),
       unnest($3::int[]),
       unnest($4::int[]),
       unnest($5::text[]),
       unnest($6::text[]),
       unnest($7::text[]),
       unnest($8::int[]),
       unnest($9::int[]),
       unnest($10::boolean[]),
       unnest($11::int[]),
       unnest($12::text[]),
       unnest($13::int[]),
       unnest($14::text[]),
       unnest($15::text[])
     ON CONFLICT (gameid, sequence) DO UPDATE SET
       espn_play_id      = EXCLUDED.espn_play_id,
       period            = EXCLUDED.period,
       clock             = EXCLUDED.clock,
       description       = EXCLUDED.description,
       short_text        = EXCLUDED.short_text,
       home_score        = EXCLUDED.home_score,
       away_score        = EXCLUDED.away_score,
       scoring_play      = EXCLUDED.scoring_play,
       team_id           = EXCLUDED.team_id,
       play_type         = EXCLUDED.play_type,
       drive_number      = EXCLUDED.drive_number,
       drive_description = EXCLUDED.drive_description,
       drive_result      = EXCLUDED.drive_result`,
    [
      gameId,
      rows.map((r) => r.espn_play_id),
      rows.map((r) => r.sequence),
      rows.map((r) => r.period),
      rows.map((r) => r.clock),
      rows.map((r) => r.description),
      rows.map((r) => r.short_text),
      rows.map((r) => r.home_score),
      rows.map((r) => r.away_score),
      rows.map((r) => r.scoring_play),
      rows.map((r) => r.team_id),
      rows.map((r) => r.play_type),
      rows.map((r) => r.drive_number),
      rows.map((r) => r.drive_description),
      rows.map((r) => r.drive_result),
    ],
  );
}

function resolveTeamId(espnTeamId, homeEspnId, awayEspnId, homeTeamId, awayTeamId) {
  if (!espnTeamId) return null;
  const id = parseInt(espnTeamId, 10);
  if (id === homeEspnId) return homeTeamId;
  if (id === awayEspnId) return awayTeamId;
  return null;
}

function extractPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId) {
  const plays = summaryData.plays;
  if (!Array.isArray(plays) || plays.length === 0) return [];

  return plays.map((play) => ({
    espn_play_id:      String(play.id ?? play.sequenceNumber ?? ""),
    sequence:          parseInt(play.sequenceNumber ?? play.id, 10),
    period:            play.period?.number ?? play.period ?? 1,
    clock:             play.clock?.displayValue ?? null,
    description:       play.text ?? play.shortText ?? "",
    short_text:        play.shortText ?? null,
    home_score:        play.homeScore != null ? parseInt(play.homeScore, 10) : null,
    away_score:        play.awayScore != null ? parseInt(play.awayScore, 10) : null,
    scoring_play:      !!play.scoringPlay,
    team_id:           resolveTeamId(play.team?.id, homeEspnId, awayEspnId, homeTeamId, awayTeamId),
    play_type:         play.type?.text ?? null,
    drive_number:      null,
    drive_description: null,
    drive_result:      null,
  })).filter((r) => r.sequence > 0 && r.description);
}

function extractNflPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId) {
  const drivesObj = summaryData.drives;
  if (!drivesObj) return [];

  const driveList = [];
  if (Array.isArray(drivesObj.previous)) driveList.push(...drivesObj.previous);
  if (drivesObj.current) driveList.push(drivesObj.current);

  const rows = [];
  driveList.forEach((drive, driveIdx) => {
    const driveNumber = driveIdx + 1;
    const drivePlays = drive.plays;
    if (!Array.isArray(drivePlays)) return;

    drivePlays.forEach((play) => {
      const seq = parseInt(play.sequenceNumber ?? play.id, 10);
      if (!seq || seq <= 0) return;
      const desc = play.text ?? play.shortText ?? "";
      if (!desc) return;

      rows.push({
        espn_play_id:      String(play.id ?? seq),
        sequence:          seq,
        period:            play.period?.number ?? play.start?.period?.number ?? 1,
        clock:             play.clock?.displayValue ?? play.start?.clock?.displayValue ?? null,
        description:       desc,
        short_text:        play.shortText ?? null,
        home_score:        play.homeScore != null ? parseInt(play.homeScore, 10) : null,
        away_score:        play.awayScore != null ? parseInt(play.awayScore, 10) : null,
        scoring_play:      !!play.scoringPlay,
        team_id:           resolveTeamId(play.team?.id ?? drive.team?.id, homeEspnId, awayEspnId, homeTeamId, awayTeamId),
        play_type:         play.type?.text ?? null,
        drive_number:      driveNumber,
        drive_description: drive.description ?? null,
        drive_result:      drive.result ?? null,
      });
    });
  });

  return rows;
}
