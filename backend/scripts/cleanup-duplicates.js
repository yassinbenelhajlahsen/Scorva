import dotenv from "dotenv";
import { Pool } from "pg";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    console.log("🧹 Cleaning up duplicate games...");

    const result = await pool.query(`
      DELETE FROM games g1
      WHERE eventid IS NULL
        AND EXISTS (
          SELECT 1 FROM games g2
          WHERE ABS(g1.date::date - g2.date::date) <= 1
            AND g1.hometeamid = g2.hometeamid
            AND g1.awayteamid = g2.awayteamid
            AND g1.league = g2.league
            AND g2.eventid IS NOT NULL
        )
    `);

    console.log(`✅ Deleted ${result.rowCount} duplicate game rows`);

    const countResult = await pool.query("SELECT COUNT(*) as total FROM games");
    console.log(`📊 Total games remaining: ${countResult.rows[0].total}`);

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
