import { inferParticipantRoles } from "../mappings/nbaPlayRoles.js";

/**
 * Resolves ESPN play participants → internal player IDs and writes to
 * play_participants. Idempotent: deletes existing participants for the game
 * before inserting fresh ones.
 *
 * NBA only for v1 — early exits for other leagues. NFL/NHL phases will add
 * their own role inference modules and dispatch here.
 */
export default async function upsertPlayParticipants(client, gameId, summaryData, league) {
  if (league !== "nba") return;
  const plays = Array.isArray(summaryData.plays) ? summaryData.plays : [];
  if (plays.length === 0) return;

  // Step 1: gather all espn athlete IDs across all rated plays
  const ratedPlays = plays.map((p) => ({
    sequence: parseInt(p.sequenceNumber ?? p.id, 10),
    roles: inferParticipantRoles(p),
  })).filter((p) => p.sequence > 0 && p.roles.length > 0);

  if (ratedPlays.length === 0) return;

  const allEspnIds = [...new Set(ratedPlays.flatMap((p) => p.roles.map((r) => r.espnAthleteId)))];

  // Step 2: resolve to internal player.id
  const { rows: playerRows } = await client.query(
    `SELECT id, espn_playerid FROM players
       WHERE league = 'nba' AND espn_playerid = ANY($1::int[])`,
    [allEspnIds.map((s) => parseInt(s, 10))],
  );
  const espnToPlayer = new Map(playerRows.map((r) => [String(r.espn_playerid), r.id]));

  // Step 3: resolve sequence -> play.id (after upsertPlays has run for this game)
  const { rows: playRows } = await client.query(
    `SELECT id, sequence FROM plays WHERE gameid = $1`,
    [gameId],
  );
  const seqToPlay = new Map(playRows.map((r) => [r.sequence, r.id]));

  // Step 4: build insert tuples, dropping any participants we can't resolve
  const playIds = [];
  const playerIds = [];
  const roles = [];
  const espnAthleteIds = [];

  for (const { sequence, roles: rps } of ratedPlays) {
    const playId = seqToPlay.get(sequence);
    if (!playId) continue;
    for (const { espnAthleteId, role } of rps) {
      const playerId = espnToPlayer.get(espnAthleteId);
      if (!playerId) continue;
      playIds.push(playId);
      playerIds.push(playerId);
      roles.push(role);
      espnAthleteIds.push(espnAthleteId);
    }
  }

  // Step 5: idempotent DELETE + INSERT
  await client.query(
    `DELETE FROM play_participants
       WHERE play_id IN (SELECT id FROM plays WHERE gameid = $1)`,
    [gameId],
  );

  if (playIds.length === 0) return;

  await client.query(
    `INSERT INTO play_participants (play_id, player_id, role, espn_athlete_id)
     SELECT
       unnest($1::int[]),
       unnest($2::int[]),
       unnest($3::text[]),
       unnest($4::text[])`,
    [playIds, playerIds, roles, espnAthleteIds],
  );
}
