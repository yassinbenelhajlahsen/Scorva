import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../logger.js";

const log = logger.child({ worker: "historicalUpsert" });
import {
  runDateRangeProcessing,
  clearPlayerCache,
  getPlayerCacheStats,
} from "./src/eventProcessor.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

function getAllDatesInRange(startISO, endISO) {
  const dates = [];
  const curr = new Date(startISO);
  const last = new Date(endISO);

  while (curr <= last) {
    const yyyy = curr.getUTCFullYear().toString();
    const mm = String(curr.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(curr.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}${mm}${dd}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

const leagues = [
  { slug: "nba", seasonStart: "2023-10-24", seasonEnd: "2025-06-22" }, // 2024-25 playoffs → NBA Finals Game 7
  { slug: "nhl", seasonStart: "2023-10-10", seasonEnd: "2025-06-17" }, // 2024-25 playoffs → Stanley Cup Final Game 5
  { slug: "nfl", seasonStart: "2023-09-07", seasonEnd: "2026-01-09" }, // 2025-26 playoffs → Super Bowl LX
];

(async () => {
  try {
    // Run all leagues in parallel to save time
    await Promise.all(
      leagues.map(async ({ slug, seasonStart, seasonEnd }) => {
        const dates = getAllDatesInRange(seasonStart, seasonEnd);
        await runDateRangeProcessing(slug, dates, pool);
      }),
    );

    // Log cache stats before clearing (useful for monitoring optimization impact)
    const cacheStats = getPlayerCacheStats();
    log.info({ cacheSize: cacheStats.size }, "player cache stats");

    // Clear the player cache to free memory after run completes
    clearPlayerCache();
  } catch (err) {
    log.error({ err }, "fatal error");
  } finally {
    // Always clear cache on exit to prevent memory leaks
    clearPlayerCache();
    await pool.end();
    process.exit(0);
  }
})();
