import logger from "../../logger.js";
import { invalidatePattern } from "../../cache/cache.js";

const log = logger.child({ worker: "cleanupPlays" });

/**
 * Delete non-scoring plays for finalized games.
 * Scoring plays are retained so play-by-play scoring timelines remain intact.
 * The (gameid, scoring_play) index makes this fast.
 */
export async function cleanupNonScoringPlays(pool, league) {
  const { rowCount } = await pool.query(
    `DELETE FROM plays
     WHERE scoring_play = FALSE
       AND gameid IN (
         SELECT id FROM games
         WHERE league = $1
           AND status ILIKE '%final%'
       )`,
    [league],
  );

  if (rowCount > 0) {
    log.info({ league, deleted: rowCount }, "deleted non-scoring plays for final games");
    await invalidatePattern(`plays:${league}:*`);
  }

  return rowCount;
}
