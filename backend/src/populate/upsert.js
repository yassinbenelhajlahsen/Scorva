import dotenv from "dotenv";
import { Pool } from "pg";
import {
  runTodayProcessing,
  runUpcomingProcessing,
  clearPlayerCache,
  getPlayerCacheStats,
} from "./src/eventProcessor.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { DateTime } from "luxon";

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
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Starting upsert at ${formattedTime}`);
  console.log(`${"=".repeat(60)}`);

  try {
    const leagues = ["nba", "nfl", "nhl"];

    for (const league of leagues) {
      console.log(`\n📋 Processing ${league.toUpperCase()}...`);
      await runTodayProcessing(league, pool);
      await runUpcomingProcessing(league, pool);
    }

    // Log optimization stats before clearing (useful for monitoring impact)
    const stats = getPlayerCacheStats();

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 RUN SUMMARY`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   Games processed:     ${stats.gamesProcessed}`);
    console.log(`   FINAL games skipped: ${stats.skippedFinalGames}`);
    console.log(`   Players upserted:    ${stats.playersUpserted}`);
    console.log(`   Stats upserted:      ${stats.statsUpserted}`);
    console.log(`   ESPN API calls:      ${stats.espnApiCalls}`);
    console.log(`   Cache hits:          ${stats.cacheHits}`);
    console.log(`   DB hits:             ${stats.dbHits}`);
    console.log(`${"=".repeat(60)}`);

    // Clear the player cache to free memory after run completes
    clearPlayerCache();

    console.log(`\n✅ Upsert completed successfully at ${formattedTime}\n`);
  } catch (err) {
    console.error("❌ [upsert] fatal error:", err);
  } finally {
    // Always clear cache on exit to prevent memory leaks
    clearPlayerCache();
    await pool.end();
    process.exit(0);
  }
})();
