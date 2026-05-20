import logger from "../logger.js";

const log = logger.child({ worker: "refreshPopularity" });

export async function refreshPopularity(pool) {
  log.info("refreshing player popularity scores");
  // IS DISTINCT FROM gate skips the rewrite when the count hasn't moved.
  // The upsert worker runs every 30 min; without this, every cycle rewrote
  // all ~14k players (~523k updates/day) even though only the handful who
  // played a recent game actually had a new count.
  const res = await pool.query(`
    UPDATE players p
    SET popularity = COALESCE(sub.game_count, 0)
    FROM (
      SELECT playerid, COUNT(*) AS game_count
      FROM stats
      GROUP BY playerid
    ) sub
    WHERE p.id = sub.playerid
      AND p.popularity IS DISTINCT FROM COALESCE(sub.game_count, 0)
  `);
  log.info({ updated: res.rowCount }, "player popularity scores refreshed");
}
