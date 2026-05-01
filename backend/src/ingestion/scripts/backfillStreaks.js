/**
 * One-time script: scan and upsert active streaks for the entire current
 * season (or an explicit season via --season). Mirrors the live
 * updateStreakEvents worker but with no recency window.
 *
 * Usage:
 *   node src/ingestion/scripts/backfillStreaks.js
 *   node src/ingestion/scripts/backfillStreaks.js --league nba
 *   node src/ingestion/scripts/backfillStreaks.js --season 2025-26
 *   node src/ingestion/scripts/backfillStreaks.js --league nba --season 2025-26
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";
import { updateStreakEvents } from "../streakEvents.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillStreaks" });

const ALL_LEAGUES = ["nba", "nfl", "nhl"];

function parseArgs(argv) {
  const out = { league: null, season: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--league") out.league = argv[++i];
    else if (a === "--season") out.season = argv[++i];
  }
  return out;
}

async function backfill() {
  const { league: leagueArg, season: seasonArg } = parseArgs(process.argv);
  const leagues = leagueArg ? [leagueArg] : ALL_LEAGUES;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    for (const league of leagues) {
      const season = seasonArg ?? (await getCurrentSeason(league));
      if (!season) {
        log.warn({ league }, "no season resolved; skipping");
        continue;
      }
      log.info({ league, season }, "backfilling streaks");
      await updateStreakEvents(pool, league, { season });
    }
  } finally {
    await pool.end();
  }
}

backfill()
  .then(() => log.info("backfill complete"))
  .catch((err) => {
    log.error({ err }, "backfill failed");
    process.exit(1);
  });
