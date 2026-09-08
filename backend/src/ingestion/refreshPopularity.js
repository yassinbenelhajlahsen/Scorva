import { DateTime } from "luxon";
import logger from "../logger.js";
import { cached } from "../cache/cache.js";

const log = logger.child({ worker: "refreshPopularity" });

// popularity = COUNT(stats) per player. Only players who appeared in a game in
// the last few days can have a new count, so the scheduled path recomputes just
// those. A full pass still runs once a day to pick up anything the window
// misses (historical backfills, stat repairs on old games). Before this the
// full GROUP BY over all ~1.1M stats rows ran every 30 min to change ~1 row —
// the single largest CPU consumer and 5× the shared_buffers size in reads.
const INCREMENTAL_WINDOW_DAYS = 3;
const FULL_PASS_MEMO_TTL_SECONDS = 2 * 24 * 60 * 60;

const INCREMENTAL_SQL = `
  UPDATE players p
  SET popularity = sub.game_count
  FROM (
    SELECT s.playerid, COUNT(*)::int AS game_count
    FROM stats s
    WHERE s.playerid IN (
      SELECT DISTINCT r.playerid
      FROM games g
      JOIN stats r ON r.gameid = g.id
      WHERE g.date >= CURRENT_DATE - $1::int
    )
    GROUP BY s.playerid
  ) sub
  WHERE p.id = sub.playerid
    AND p.popularity IS DISTINCT FROM sub.game_count
`;

const FULL_SQL = `
  UPDATE players p
  SET popularity = COALESCE(sub.game_count, 0)
  FROM (
    SELECT playerid, COUNT(*) AS game_count
    FROM stats
    GROUP BY playerid
  ) sub
  WHERE p.id = sub.playerid
    AND p.popularity IS DISTINCT FROM COALESCE(sub.game_count, 0)
`;

export async function refreshPopularity(pool) {
  const res = await pool.query(INCREMENTAL_SQL, [INCREMENTAL_WINDOW_DAYS]);
  log.info({ updated: res.rowCount }, "player popularity refreshed (recent games)");

  const today = DateTime.now().setZone("America/New_York").toISODate();
  let ran = false;
  await cached(`ingest:popularity:full:${today}`, FULL_PASS_MEMO_TTL_SECONDS, async () => {
    const full = await pool.query(FULL_SQL);
    log.info({ updated: full.rowCount }, "player popularity refreshed (daily full pass)");
    ran = true;
    return true;
  });
  if (!ran) log.debug("daily full popularity pass already ran today");
}
