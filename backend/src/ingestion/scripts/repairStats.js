import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";
import { getEventsByDate } from "../espnAPIClient.js";
import { processEvent } from "../eventProcessor.js";
import { clearPlayerCache, getPlayerCacheStats } from "../playerCacheManager.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "repairStats" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Find NBA games with blank stat rows:
 * rows where points=0, fg='0-0', and minutes IS NULL
 * (player actually played but stats weren't ingested).
 */
async function findBrokenNbaGames() {
  const { rows } = await pool.query(`
    SELECT DISTINCT g.id, g.eventid, g.league, g.date, g.season
    FROM games g
    JOIN stats s ON s.gameid = g.id
    WHERE g.league = 'nba'
      AND g.status = 'Final'
      AND g.type IN ('regular', 'makeup')
      AND g.eventid IS NOT NULL
      AND s.points = 0
      AND s.fg = '0-0'
      AND s.minutes IS NULL
    ORDER BY g.date
  `);
  return rows;
}

/**
 * Count NHL goalie stat rows with NULL g/a (should be 0, not NULL).
 * This is a direct SQL fix — no ESPN re-fetch needed.
 */
async function countNhlGoalieNulls() {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS cnt
    FROM stats s
    JOIN players p ON s.playerid = p.id
    WHERE p.league = 'nhl'
      AND s.g IS NULL
      AND s.a IS NULL
  `);
  return parseInt(rows[0].cnt, 10);
}

/**
 * Fix NHL goalie stats: set NULL g/a to 0.
 * Goalies in older seasons (pre-2023) had goals/assists stored as NULL
 * instead of 0. This breaks AVG() and SUM() calculations since NULL
 * rows are silently skipped.
 */
async function fixNhlGoalieNulls(dryRun) {
  const count = await countNhlGoalieNulls();
  log.info({ count }, "NHL goalie stat rows with NULL g/a");

  if (count === 0) {
    log.info("no NHL goalie nulls to fix");
    return 0;
  }

  if (dryRun) return count;

  const { rowCount } = await pool.query(`
    UPDATE stats s
    SET g = COALESCE(s.g, 0),
        a = COALESCE(s.a, 0)
    FROM players p
    WHERE s.playerid = p.id
      AND p.league = 'nhl'
      AND (s.g IS NULL OR s.a IS NULL)
  `);

  log.info({ updated: rowCount }, "NHL goalie NULL g/a → 0 fix applied");
  return rowCount;
}

/**
 * Find games across all leagues with suspiciously few stat rows.
 * MIN_STAT_ROWS thresholds: nba=12, nhl=20, nfl=10
 * Only targets games that already have an eventid.
 */
async function findLowStatCountGames() {
  const { rows } = await pool.query(`
    SELECT g.id, g.eventid, g.league, g.date, g.season, COUNT(s.id) AS stat_count
    FROM games g
    LEFT JOIN stats s ON s.gameid = g.id
    WHERE g.status = 'Final'
      AND g.type IN ('regular', 'makeup')
      AND g.eventid IS NOT NULL
    GROUP BY g.id
    HAVING (
      (g.league = 'nba' AND COUNT(s.id) < 12) OR
      (g.league = 'nhl' AND COUNT(s.id) < 20) OR
      (g.league = 'nfl' AND COUNT(s.id) < 10)
    )
    ORDER BY g.league, g.date
  `);
  return rows;
}

/**
 * Group games by league + date (YYYYMMDD) so we fetch each scoreboard once.
 */
function groupByLeagueDate(games) {
  const groups = new Map();
  for (const game of games) {
    const dateStr = new Date(game.date).toISOString().slice(0, 10).replace(/-/g, "");
    const key = `${game.league}:${dateStr}`;
    if (!groups.has(key)) {
      groups.set(key, { league: game.league, dateStr, eventIds: new Set() });
    }
    groups.get(key).eventIds.add(game.eventid);
  }
  return [...groups.values()];
}

/**
 * For a single league+date group, fetch the scoreboard and re-process
 * matching events with force=true.
 */
async function repairGroup(group) {
  const { league, dateStr, eventIds } = group;
  let events;
  try {
    events = await getEventsByDate(dateStr, league);
  } catch (err) {
    log.warn({ league, dateStr, err: err.message }, "scoreboard fetch failed — skipping date");
    return { processed: 0, failed: 0, skipped: eventIds.size };
  }

  const matching = events.filter((e) => eventIds.has(parseInt(e.id, 10)));

  if (matching.length === 0) {
    log.info({ league, dateStr, expected: eventIds.size }, "no matching events in ESPN response");
    return { processed: 0, failed: 0, skipped: eventIds.size };
  }

  let processed = 0;
  let failed = 0;

  for (const event of matching) {
    const client = await pool.connect();
    try {
      await processEvent(client, league, event, { force: true });
      processed++;
    } catch (err) {
      log.error({ eventId: event.id, league, err: err.message }, "repair failed for event");
      failed++;
    } finally {
      client.release();
    }
  }

  return { processed, failed, skipped: eventIds.size - matching.length };
}

async function main() {
  const args = process.argv.slice(2);
  const leagueFilter = args.find((a) => ["nba", "nhl", "nfl"].includes(a));
  const mode = args.find((a) => ["blank", "null", "low", "all"].includes(a)) || "all";
  const dryRun = args.includes("--dry-run");

  log.info({ mode, leagueFilter: leagueFilter || "all", dryRun }, "starting stat repair audit");

  // --- NHL goalie NULL fix (direct SQL, no ESPN fetch) ---
  if ((mode === "all" || mode === "null") && (!leagueFilter || leagueFilter === "nhl")) {
    await fixNhlGoalieNulls(dryRun);
  }

  // --- ESPN re-fetch repairs ---
  let allBroken = [];

  if ((mode === "all" || mode === "blank") && (!leagueFilter || leagueFilter === "nba")) {
    const nbaBlank = await findBrokenNbaGames();
    log.info({ count: nbaBlank.length }, "NBA games with blank stat rows (needs ESPN re-fetch)");
    allBroken.push(...nbaBlank);
  }

  if ((mode === "all" || mode === "low") && !leagueFilter) {
    const lowCount = await findLowStatCountGames();
    log.info({ count: lowCount.length }, "games with low stat row count (needs ESPN re-fetch)");
    allBroken.push(...lowCount);
  } else if (mode === "low" && leagueFilter) {
    const lowCount = await findLowStatCountGames();
    const filtered = lowCount.filter((g) => g.league === leagueFilter);
    log.info({ count: filtered.length }, `${leagueFilter} games with low stat row count (needs ESPN re-fetch)`);
    allBroken.push(...filtered);
  }

  // Deduplicate by game ID
  const seen = new Set();
  const unique = allBroken.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  if (unique.length === 0) {
    log.info("no games need ESPN re-fetch repair");
    await pool.end();
    return;
  }

  log.info({ totalUnique: unique.length }, "unique games needing ESPN re-fetch");

  // Print season breakdown
  const seasonCounts = {};
  for (const g of unique) {
    const key = `${g.league}:${g.season}`;
    seasonCounts[key] = (seasonCounts[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(seasonCounts).sort()) {
    log.info({ key, count }, "games to repair");
  }

  if (dryRun) {
    log.info("dry run — not making ESPN re-fetch changes");
    await pool.end();
    return;
  }

  // Group by league+date for efficient scoreboard fetching
  const groups = groupByLeagueDate(unique);
  log.info({ dateGroups: groups.length }, "scoreboard date groups to fetch");

  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < groups.length; i += BATCH_SIZE) {
    const batch = groups.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(batch.map((g) => repairGroup(g)));

    for (const r of results) {
      totalProcessed += r.processed;
      totalFailed += r.failed;
      totalSkipped += r.skipped;
    }

    if ((i + BATCH_SIZE) % 50 === 0) {
      log.info(
        { progress: `${i + BATCH_SIZE}/${groups.length}`, totalProcessed, totalFailed, totalSkipped },
        "repair progress",
      );
    }

    if (i + BATCH_SIZE < groups.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const cacheStats = getPlayerCacheStats();
  log.info({ cacheSize: cacheStats.size }, "player cache stats");
  clearPlayerCache();

  log.info(
    { totalProcessed, totalFailed, totalSkipped, totalGames: unique.length },
    "repair complete",
  );

  await pool.end();
}

main().catch((err) => {
  log.error({ err }, "repair script crashed");
  clearPlayerCache();
  pool.end().finally(() => process.exit(1));
});
