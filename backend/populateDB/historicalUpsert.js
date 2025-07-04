import dotenv from "dotenv";
import path from 'path';
import { Pool } from "pg";
import {
  runDateRangeProcessing
} from "./src/eventProcessor.js";

dotenv.config({ path: path.resolve('../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  ssl: process.env.NODE_ENV === "production"
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
  //{ slug: "nfl", seasonStart: "2024-09-05", seasonEnd: "2025-02-09" }, 
  { slug: "nba", seasonStart: "2025-03-01", seasonEnd: "2025-06-10" },
  { slug: "nhl", seasonStart: "2025-03-01", seasonEnd: "2025-06-10" },
];

(async () => {
  try {
    // Run all leagues in parallel to save time
    await Promise.all(
      leagues.map(async ({ slug, seasonStart, seasonEnd }) => {
        const dates = getAllDatesInRange(seasonStart, seasonEnd);
        await runDateRangeProcessing(slug, dates, pool);
      })
    );
  } catch (err) {
    console.error("❌ [historicalUpsert] Fatal error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
