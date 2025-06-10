import dotenv from "dotenv";
import { Pool } from "pg";
import { runTodayProcessing } from "./src/eventProcessor.js";
import path from 'path';

dotenv.config({ path: path.resolve('../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

(async () => {
  try {
    // For each league, fetch and process today’s events
    await runTodayProcessing("nba", pool);
    //await runTodayProcessing("nfl", pool); commented out to avoid unwanted updates to database
    await runTodayProcessing("nhl", pool);
    console.log(`[✔️ ${new Date().toISOString()}] Hourly upsert ran successfully.`);
  } catch (err) {
    console.error("❌ [hourlyUpsert] fatal error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
