import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../logger.js";

const log = logger.child({ worker: "upsert" });
import {
  runTodayProcessing,
  runUpcomingProcessing,
  clearPlayerCache,
  getPlayerCacheStats,
} from "./eventProcessor.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { DateTime } from "luxon";
import { invalidatePattern, closeCache } from "../cache/cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const nowEST = DateTime.now().setZone("America/New_York");

function addOrdinal(day) {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Build formatted timestamp string
const formattedTime = `${nowEST.toFormat("MMMM")} ${addOrdinal(
  nowEST.day,
)}, ${nowEST.toFormat("yyyy")} @ ${nowEST.toFormat("h:mma").toLowerCase()}`;

(async () => {
  log.info({ time: formattedTime }, "starting upsert");

  try {
    const leagues = ["nba", "nfl", "nhl"];

    for (const league of leagues) {
      log.info({ league }, "processing league");
      try {
        await runTodayProcessing(league, pool);
        await runUpcomingProcessing(league, pool);
        await invalidatePattern(`games:${league}:*`);
        await invalidatePattern(`standings:${league}:*`);
        await invalidatePattern(`gameDates:${league}:*`);
      } catch (err) {
        log.error({ err, league }, "failed processing league");
      }
    }

    // Log optimization stats before clearing (useful for monitoring impact)
    const stats = getPlayerCacheStats();

    log.info({ stats }, "run summary");

    // Clear the player cache to free memory after run completes
    clearPlayerCache();

    log.info({ time: formattedTime }, "upsert completed");
  } catch (err) {
    log.error({ err }, "fatal error");
  } finally {
    // Always clear cache on exit to prevent memory leaks
    clearPlayerCache();
    await closeCache();
    await pool.end();
    process.exit(0);
  }
})();
