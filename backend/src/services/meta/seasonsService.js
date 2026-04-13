import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";

export async function getSeasons(league) {
  return cached(`seasons:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT DISTINCT season FROM games WHERE league = $1 AND season IS NOT NULL ORDER BY season DESC`,
      [league]
    );
    return result.rows.map((r) => r.season);
  });
}
