import pool from "../db/db.js";

export async function getSeasons(league) {
  const result = await pool.query(
    `SELECT DISTINCT season FROM games WHERE league = $1 AND season IS NOT NULL ORDER BY season DESC LIMIT 3`,
    [league]
  );
  return result.rows.map((r) => r.season);
}
