import dotenv from "dotenv";
import { Pool } from "pg";
import { runTodayProcessing } from "./src/eventProcessor.js";
import path from 'path';
import { DateTime } from "luxon";

dotenv.config({ path: path.resolve('../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: process.env.NODE_ENV === "production"
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
const formattedTime = `${nowEST.toFormat("MMMM")} ${addOrdinal(nowEST.day)}, ${nowEST.toFormat("yyyy")} @ ${nowEST.toFormat("h:mma").toLowerCase()}`;

(async () => {
  try {
    // For each league, fetch and process today’s events
    await runTodayProcessing("nba", pool);
    //await runTodayProcessing("nfl", pool); commented out to avoid unwanted updates to database
    await runTodayProcessing("nhl", pool);
    console.log(`[ ${formattedTime} ✅ Hourly upsert ran successfully.`);
  } catch (err) {
    console.error("❌ [hourlyUpsert] fatal error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
