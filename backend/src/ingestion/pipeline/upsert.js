import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";

const log = logger.child({ worker: "upsert" });
import {
  runTodayProcessing,
  runUpcomingProcessing,
  clearPlayerCache,
  getPlayerCacheStats,
} from "./eventProcessor.js";
import { refreshPopularity } from "../refreshPopularity.js";
import { computeAllEmbeddings } from "../computePlayerEmbeddings.js";
import { cleanupClinchedPlayoffGames } from "../cleanup/cleanupClinchedPlayoffGames.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { DateTime } from "luxon";
import { invalidatePattern, closeCache } from "../../cache/cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

export function addOrdinal(day) {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function runUpsert(pool) {
  const nowEST = DateTime.now().setZone("America/New_York");
  const formattedTime = `${nowEST.toFormat("MMMM")} ${addOrdinal(
    nowEST.day,
  )}, ${nowEST.toFormat("yyyy")} @ ${nowEST.toFormat("h:mma").toLowerCase()}`;

  log.info({ time: formattedTime }, "starting upsert");

  try {
    const leagues = ["nba", "nfl", "nhl"];

    for (const league of leagues) {
      log.info({ league }, "processing league");
      try {
        await runTodayProcessing(league, pool);
        await runUpcomingProcessing(league, pool);
        if (league === "nba" || league === "nhl") {
          // Isolated so a cleanup failure still lets cache invalidations below run.
          try {
            await cleanupClinchedPlayoffGames(pool, league);
          } catch (err) {
            log.error({ err, league }, "failed cleaning up clinched playoff games");
          }
        }
        await invalidatePattern(`games:${league}:*`);
        await invalidatePattern(`standings:${league}:*`);
        await invalidatePattern(`gameDates:${league}:*`);
        if (league === "nba") await invalidatePattern("playoffs:nba:*");
        if (league === "nhl") await invalidatePattern("playoffs:nhl:*");
        if (league === "nfl") await invalidatePattern("playoffs:nfl:*");
      } catch (err) {
        log.error({ err, league }, "failed processing league");
      }
    }

    await refreshPopularity(pool);
    await computeAllEmbeddings(pool);
    await invalidatePattern("similarPlayers:*");

    const stats = getPlayerCacheStats();
    log.info({ stats }, "run summary");

    clearPlayerCache();

    log.info({ time: formattedTime }, "upsert completed");
  } catch (err) {
    log.error({ err }, "fatal error");
  } finally {
    clearPlayerCache();
    await closeCache();
    await pool.end();
  }
}

// CLI entry point — only runs when executed directly, not when imported by tests
if (resolve(process.argv[1]) === __filename) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });
  await runUpsert(pool);
  process.exit(0);
}
