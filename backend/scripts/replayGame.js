/**
 * Replays a finished game as if it were live.
 *
 * Usage: node scripts/replayGame.js <gameId> [--interval 2000] [--batch 10]
 *
 * - Resets the game to "In Progress", deletes its plays
 * - Progressively re-inserts plays in batches, updating score/clock/period
 * - Fires pg_notify so the SSE pipeline pushes updates to the frontend
 * - Restores the game to Final when done (or on Ctrl-C)
 *
 * Stop the liveSync worker before running this to avoid conflicts.
 */

import pool from "../src/db/db.js";

const args = process.argv.slice(2);
const gameId = parseInt(args.find((a) => !a.startsWith("--")), 10);
if (!gameId) {
  console.error("Usage: node scripts/replayGame.js <gameId> [--interval ms] [--batch n]");
  process.exit(1);
}

function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1], 10) : fallback;
}

const INTERVAL_MS = flag("interval", 2000);
const BATCH_SIZE = flag("batch", 10);

let original = null;
let eventId = null;

async function restore() {
  if (!original) return;
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE games SET status = $1, current_period = $2, clock = $3,
       homescore = $4, awayscore = $5,
       firstqtr = $6, secondqtr = $7, thirdqtr = $8, fourthqtr = $9
       WHERE id = $10`,
      [
        original.status, original.current_period, original.clock,
        original.homescore, original.awayscore,
        original.firstqtr, original.secondqtr, original.thirdqtr, original.fourthqtr,
        gameId,
      ],
    );
    await client.query("SELECT pg_notify('game_updated', $1)", [String(eventId)]);
    console.log("\nGame restored to Final.");
  } finally {
    client.release();
  }
}

async function main() {
  const client = await pool.connect();

  try {
    // Load original game state
    const { rows: [game] } = await client.query("SELECT * FROM games WHERE id = $1", [gameId]);
    if (!game) { console.error("Game not found"); process.exit(1); }
    if (!game.status?.toLowerCase().includes("final")) {
      console.error(`Game status is "${game.status}" — only Final games can be replayed`);
      process.exit(1);
    }

    original = game;
    eventId = game.eventid;

    // Load all plays
    const { rows: allPlays } = await client.query(
      "SELECT * FROM plays WHERE gameid = $1 ORDER BY sequence ASC",
      [gameId],
    );
    if (allPlays.length === 0) { console.error("No plays found for this game"); process.exit(1); }

    console.log(`Replaying game ${gameId} (event ${eventId}) — ${allPlays.length} plays`);
    console.log(`Interval: ${INTERVAL_MS}ms, Batch size: ${BATCH_SIZE}`);
    console.log("Press Ctrl-C to stop and restore.\n");

    // Reset game
    await client.query("DELETE FROM plays WHERE gameid = $1", [gameId]);
    await client.query(
      `UPDATE games SET status = 'In Progress', current_period = 1, clock = '12:00',
       homescore = 0, awayscore = 0,
       firstqtr = NULL, secondqtr = NULL, thirdqtr = NULL, fourthqtr = NULL
       WHERE id = $1`,
      [gameId],
    );
    await client.query("SELECT pg_notify('game_updated', $1)", [String(eventId)]);

    // Replay loop
    for (let i = 0; i < allPlays.length; i += BATCH_SIZE) {
      const batch = allPlays.slice(i, i + BATCH_SIZE);
      const lastPlay = batch[batch.length - 1];

      // Insert batch
      for (const play of batch) {
        await client.query(
          `INSERT INTO plays (gameid, espn_play_id, sequence, period, clock, description, short_text,
           home_score, away_score, scoring_play, team_id, play_type,
           drive_number, drive_description, drive_result)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (gameid, sequence) DO NOTHING`,
          [
            gameId, play.espn_play_id, play.sequence, play.period, play.clock,
            play.description, play.short_text, play.home_score, play.away_score,
            play.scoring_play, play.team_id, play.play_type,
            play.drive_number, play.drive_description, play.drive_result,
          ],
        );
      }

      // Update game state
      await client.query(
        `UPDATE games SET current_period = $1, clock = $2,
         homescore = COALESCE($3, homescore), awayscore = COALESCE($4, awayscore)
         WHERE id = $5`,
        [lastPlay.period, lastPlay.clock, lastPlay.home_score, lastPlay.away_score, gameId],
      );

      await client.query("SELECT pg_notify('game_updated', $1)", [String(eventId)]);

      const pct = Math.round(((i + batch.length) / allPlays.length) * 100);
      process.stdout.write(
        `\r[${pct.toString().padStart(3)}%] P${lastPlay.period} ${(lastPlay.clock ?? "").padStart(5)} | ` +
        `${lastPlay.away_score ?? "?"}-${lastPlay.home_score ?? "?"} | ` +
        `plays ${i + 1}-${i + batch.length}/${allPlays.length}`,
      );

      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }

    console.log("\n\nReplay complete.");
  } finally {
    client.release();
  }

  await restore();
  await pool.end();
}

// Restore on Ctrl-C
process.on("SIGINT", async () => {
  await restore();
  await pool.end();
  process.exit(0);
});

main().catch(async (err) => {
  console.error(err);
  await restore();
  await pool.end();
  process.exit(1);
});
