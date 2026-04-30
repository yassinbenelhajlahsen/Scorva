import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";
import { getEventsByDate } from "../espn/espnAPIClient.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillEventids" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const BUCKET_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;
const DRY_RUN = process.argv.includes("--dry-run");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findEspnEventId(events, homeEspnId, awayEspnId) {
  const home = String(homeEspnId);
  const away = String(awayEspnId);
  for (const ev of events) {
    const comps = ev.competitions?.[0]?.competitors || [];
    const h = comps.find((c) => c.homeAway === "home");
    const a = comps.find((c) => c.homeAway === "away");
    if (!h || !a) continue;
    if (String(h.team?.id) === home && String(a.team?.id) === away) {
      return parseInt(ev.id, 10);
    }
  }
  return null;
}

async function processBucket(client, bucket) {
  const { league, dateStr, games } = bucket;
  const events = await getEventsByDate(dateStr, league);

  let matched = 0;
  let unmatched = 0;
  let conflicts = 0;

  for (const game of games) {
    const espnEventId = findEspnEventId(events, game.home_espn, game.away_espn);
    if (!espnEventId) {
      unmatched++;
      log.warn(
        {
          gameId: game.id,
          league,
          dateStr,
          home_espn: game.home_espn,
          away_espn: game.away_espn,
        },
        "no ESPN event matched",
      );
      continue;
    }

    if (DRY_RUN) {
      matched++;
      continue;
    }

    try {
      const res = await client.query(
        "UPDATE games SET eventid = $1 WHERE id = $2 AND eventid IS NULL",
        [espnEventId, game.id],
      );
      if (res.rowCount === 1) {
        matched++;
      } else {
        unmatched++;
        log.warn({ gameId: game.id, espnEventId }, "row not updated (no longer NULL?)");
      }
    } catch (err) {
      if (err.code === "23505") {
        conflicts++;
        log.warn(
          { gameId: game.id, espnEventId, league },
          "unique conflict — another row already owns this (eventid, league)",
        );
      } else {
        throw err;
      }
    }
  }

  return { matched, unmatched, conflicts };
}

async function run() {
  log.info({ dryRun: DRY_RUN }, "starting backfillEventids");

  const client = await pool.connect();
  try {
    const gamesRes = await client.query(`
      SELECT g.id,
             g.league,
             to_char(g.date, 'YYYYMMDD') AS date_str,
             g.hometeamid,
             g.awayteamid,
             ht.espnid AS home_espn,
             at.espnid AS away_espn
      FROM games g
      JOIN teams ht ON ht.id = g.hometeamid AND ht.league = g.league
      JOIN teams at ON at.id = g.awayteamid AND at.league = g.league
      WHERE g.eventid IS NULL
      ORDER BY g.league, g.date, g.id
    `);

    const rows = gamesRes.rows;
    log.info({ total: rows.length }, "games with NULL eventid");
    if (rows.length === 0) {
      log.info("nothing to backfill");
      return;
    }

    const bucketMap = new Map();
    for (const row of rows) {
      const key = `${row.league}:${row.date_str}`;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          league: row.league,
          dateStr: row.date_str,
          games: [],
        });
      }
      bucketMap.get(key).games.push(row);
    }

    const buckets = [...bucketMap.values()];
    log.info({ buckets: buckets.length }, "ESPN scoreboard calls planned");

    let totalMatched = 0;
    let totalUnmatched = 0;
    let totalConflicts = 0;

    for (let i = 0; i < buckets.length; i += BUCKET_BATCH_SIZE) {
      const batch = buckets.slice(i, i + BUCKET_BATCH_SIZE);
      const results = await Promise.all(batch.map((b) => processBucket(client, b)));
      for (const r of results) {
        totalMatched += r.matched;
        totalUnmatched += r.unmatched;
        totalConflicts += r.conflicts;
      }

      const processedBuckets = Math.min(i + BUCKET_BATCH_SIZE, buckets.length);
      log.info(
        {
          processedBuckets,
          totalBuckets: buckets.length,
          totalMatched,
          totalUnmatched,
          totalConflicts,
        },
        "progress",
      );

      if (i + BUCKET_BATCH_SIZE < buckets.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    log.info(
      { dryRun: DRY_RUN, totalMatched, totalUnmatched, totalConflicts, total: rows.length },
      "backfill complete",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  log.error({ err }, "backfill failed");
  process.exit(1);
});
