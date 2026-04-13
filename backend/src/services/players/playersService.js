import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";

export async function getPlayersByLeague(league) {
  return cached(`players:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT *
         FROM players
        WHERE league = $1
        ORDER BY position`,
      [league]
    );
    return result.rows;
  });
}
