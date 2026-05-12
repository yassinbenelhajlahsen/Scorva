import dotenv from "dotenv";
import { Pool } from "pg";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import logger from "../../logger.js";
import { recomputeGame } from "../../services/games/ratingEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillFtRatingFix" });

/**
 * Recompute NBA games whose play_ratings show the FT possession-swap artifact.
 *
 * Bug: ESPN's homePct on the LAST FT in a trip already includes the possession
 * change to the opposing team. On a 1-point FT, that swing flipped the shooter's
 * WPA against them — a made FT could end up with negative weighted_value, and a
 * missed FT got an extra over-penalty.
 *
 * Fix: wpaContribution() now clamps FT WPA to its correct direction (made → ≥0,
 * missed → ≤0). This script re-runs recomputeGame on every affected game, which
 * rewrites play_ratings AND stats.rating atomically.
 *
 * Detection:
 *   - made FT scorer with weighted_value <= 0.6  (base alone = 0.7; lower = WPA went negative)
 *   - missed FT shot_attempter with weighted_value >= -0.4  (base alone = -0.5; higher = WPA went positive)
 */
async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 4,
  });

  const { rows } = await pool.query(`
    SELECT DISTINCT pr.game_id AS id
      FROM play_ratings pr
      JOIN plays p ON p.id = pr.play_id
      JOIN games g ON g.id = pr.game_id
     WHERE g.league = 'nba'
       AND p.play_type ILIKE 'free throw%'
       AND (
         (p.scoring_play = TRUE  AND pr.role = 'scorer'         AND pr.weighted_value <= 0.6) OR
         (p.scoring_play = FALSE AND pr.role = 'shot_attempter' AND pr.weighted_value >= -0.4)
       )
     ORDER BY pr.game_id
  `);

  log.info({ count: rows.length }, "games with FT artifact — recomputing");

  let ok = 0, fail = 0;
  for (const { id } of rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recomputeGame(client, id);
      await client.query("COMMIT");
      ok++;
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      fail++;
      log.warn({ err: err.message, gameId: id }, "recompute failed");
    } finally {
      client.release();
    }
    if (ok > 0 && ok % 50 === 0) log.info({ ok, fail, total: rows.length }, "progress");
  }

  log.info({ ok, fail, total: rows.length }, "done");
  await pool.end();
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
