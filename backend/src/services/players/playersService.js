import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { SLUG_SQL } from "../../utils/slugResolver.js";

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

export async function getDuplicatePlayerSlugs(league) {
  return cached(`players:duplicateSlugs:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT ${SLUG_SQL} AS slug, MIN(id) AS canonical_id
         FROM players
        WHERE league = $1
        GROUP BY ${SLUG_SQL}
       HAVING COUNT(*) > 1`,
      [league]
    );
    const map = {};
    for (const row of result.rows) {
      map[row.slug] = Number(row.canonical_id);
    }
    return map;
  });
}
