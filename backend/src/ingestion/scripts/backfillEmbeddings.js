import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { closeCache } from "../../cache/cache.js";
import { computeLeagueEmbeddings } from "../computePlayerEmbeddings.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillEmbeddings" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const LEAGUES = ["nba", "nfl", "nhl"];

async function backfill() {
  for (const league of LEAGUES) {
    const currentSeason = await getCurrentSeason(league);

    const { rows } = await pool.query(
      `SELECT DISTINCT season FROM games WHERE league = $1 AND season IS NOT NULL ORDER BY season`,
      [league]
    );
    const seasons = rows.map((r) => r.season).filter((s) => s !== currentSeason);

    log.info({ league, currentSeason, count: seasons.length }, "historical seasons to backfill");

    for (const season of seasons) {
      log.info({ league, season }, "computing embeddings");
      try {
        const count = await computeLeagueEmbeddings(pool, league, season);
        log.info({ league, season, count }, "embeddings upserted");
      } catch (err) {
        log.error({ err, league, season }, "failed — skipping season");
      }
    }
  }

  log.info("backfill complete");
}

backfill()
  .then(async () => {
    await closeCache();
    await pool.end();
  })
  .catch(async (err) => {
    log.error({ err }, "backfill failed");
    await closeCache();
    await pool.end();
    process.exit(1);
  });
