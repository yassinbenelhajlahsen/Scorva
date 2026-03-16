import pool from "../db/db.js";
import logger from "../logger.js";

export async function getPlayerIdBySlug(slugOrId, league) {
  try {
    const s = String(slugOrId).trim();

    if (/^\d+$/.test(s)) return parseInt(s, 10);

    const result = await pool.query(
      `SELECT id
         FROM players
        WHERE league = $1
          AND LOWER(REPLACE(name, ' ', '-')) = $2
        LIMIT 1`,
      [league, s.toLowerCase()]
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    logger.error({ err }, "Error looking up player by slug");
    return null;
  }
}
