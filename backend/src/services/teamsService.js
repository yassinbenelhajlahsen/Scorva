import pool from "../db/db.js";
import { cached } from "../cache/cache.js";

export async function getTeamsByLeague(league) {
  return cached(`teams:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT *
         FROM teams
        WHERE league = $1
        ORDER BY conf, name`,
      [league]
    );
    return result.rows;
  });
}
