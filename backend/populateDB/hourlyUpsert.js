import dotenv from "dotenv";
import { Pool } from "pg";
import { runTodayProcessing } from "./src/eventProcessor.js";
import path from 'path';

dotenv.config({ path: path.resolve('../.env') });

const pool = new Pool({
  connectionString: process.env.DB_URL,
});

(async () => {
  try {
    // For each league, fetch and process today’s events
    await runTodayProcessing("nba", pool);
    await runTodayProcessing("nfl", pool);
    await runTodayProcessing("nhl", pool);
  } catch (err) {
    console.error("❌ [hourlyUpsert] fatal error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
