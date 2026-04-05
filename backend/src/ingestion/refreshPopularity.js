import logger from "../logger.js";

const log = logger.child({ worker: "refreshPopularity" });

export async function refreshPopularity(pool) {
  log.info("refreshing player popularity scores");
  await pool.query(`
    UPDATE players p
    SET popularity = COALESCE(sub.game_count, 0)
    FROM (
      SELECT playerid, COUNT(*) AS game_count
      FROM stats
      GROUP BY playerid
    ) sub
    WHERE p.id = sub.playerid
  `);
  log.info("player popularity scores refreshed");
}
