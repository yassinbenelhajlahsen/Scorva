import pool from "../db/db.js";
import { cached } from "./cache.js";

const CURRENT_SEASON_TTL = 3600; // 1 hour

/**
 * Returns the current (max) season string for a given league.
 * Cached for 1 hour — changes at most once per year.
 */
export async function getCurrentSeason(league) {
  return cached(`currentSeason:${league}`, CURRENT_SEASON_TTL, async () => {
    const { rows } = await pool.query(
      `SELECT MAX(season) AS season FROM games WHERE league = $1 AND season IS NOT NULL`,
      [league]
    );
    return rows[0]?.season ?? null;
  });
}
