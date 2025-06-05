import dotenv from "dotenv";
import path from 'path';
import { Pool } from "pg";
import {
  runDateRangeProcessing,
  getSportPath,
  processEvent,
} from "./src/eventProcessor.js";

dotenv.config({ path: path.resolve('../.env') });

const pool = new Pool({
  connectionString: process.env.DB_URL,
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
  { slug: "nfl", seasonStart: "2024-09-03", seasonEnd: "2024-12-31" },
  { slug: "nba", seasonStart: "2024-10-22", seasonEnd: "2025-05-31" },
  { slug: "nhl", seasonStart: "2024-10-01", seasonEnd: "2025-05-31" },
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
