import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import pgDateToString from "../utils/pgDateToString.js";

export async function getGameDates(league, season) {
  const resolvedSeason = season || (await getCurrentSeason(league));
  const key = `gameDates:${league}:${resolvedSeason}`;
  const ttl = 300; // 5 min — new upcoming dates appear after each upsert

  return cached(key, ttl, async () => {
    const { rows } = await pool.query(
      `SELECT date, COUNT(*) AS count FROM games
       WHERE league = $1 AND season = $2
       GROUP BY date
       ORDER BY date ASC`,
      [league, resolvedSeason]
    );
    return rows.map((r) => ({ date: pgDateToString(r.date), count: Number(r.count) }));
  });
}
