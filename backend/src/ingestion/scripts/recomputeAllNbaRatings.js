import dotenv from "dotenv";
import { Pool } from "pg";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import logger from "../../logger.js";
import { recomputeGame } from "../../services/games/ratingEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "recomputeAllNbaRatings" });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 4,
  });

  const seasonArg = process.argv[2];
  const where = seasonArg
    ? `g.league = 'nba' AND g.season = $1 AND EXISTS (SELECT 1 FROM play_ratings pr WHERE pr.game_id = g.id)`
    : `g.league = 'nba' AND EXISTS (SELECT 1 FROM play_ratings pr WHERE pr.game_id = g.id)`;
  const params = seasonArg ? [seasonArg] : [];

  const { rows } = await pool.query(
    `SELECT g.id FROM games g WHERE ${where} ORDER BY g.id`,
    params,
  );
  log.info({ count: rows.length, season: seasonArg ?? "all" }, "recomputing NBA ratings");

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
    if (ok % 50 === 0 && ok > 0) log.info({ ok, fail, total: rows.length }, "progress");
  }

  log.info({ ok, fail, total: rows.length }, "done");
  await pool.end();
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
