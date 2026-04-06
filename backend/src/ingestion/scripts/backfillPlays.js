import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import logger from "../../logger.js";
import { getSportPath } from "../eventProcessor.js";
import upsertPlays from "../upsertPlays.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillPlays" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1500;

async function withRetry(fn, { retries = 3, baseDelayMs = 2000, label = "" } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const is429 = err?.response?.status === 429;
      const delay = is429 ? 15000 * attempt : baseDelayMs * 2 ** (attempt - 1);
      log.warn({ label, attempt, delayMs: delay }, "retrying ESPN fetch");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processGame(game) {
  const { id: gameId, eventid, league, hometeamid, awayteamid } = game;

  const teamRes = await pool.query(
    "SELECT id, espnid FROM teams WHERE id = ANY($1::int[])",
    [[hometeamid, awayteamid]],
  );

  const teamMap = Object.fromEntries(teamRes.rows.map((t) => [t.id, t.espnid]));
  const homeEspnId = teamMap[hometeamid];
  const awayEspnId = teamMap[awayteamid];

  if (!homeEspnId || !awayEspnId) {
    log.warn({ gameId }, "missing ESPN team IDs — skipping");
    return;
  }

  const sportPath = getSportPath(league);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/${league}/summary?event=${eventid}`;

  let resp;
  try {
    resp = await withRetry(() => axios.get(url), {
      label: `summary:${league}:${eventid}`,
    });
  } catch (err) {
    log.warn({ gameId, eventid, err: err.message }, "ESPN summary fetch failed — skipping");
    return;
  }

  const playCount = league === "nfl"
    ? countNflPlays(resp.data)
    : (resp.data.plays?.length ?? 0);

  if (playCount === 0) {
    log.info({ gameId, league }, "no plays in ESPN response — skipping");
    return;
  }

  await upsertPlays(
    pool,
    gameId,
    resp.data,
    league,
    hometeamid,
    awayteamid,
    homeEspnId,
    awayEspnId,
  );
}

function countNflPlays(data) {
  const drives = data.drives;
  if (!drives) return 0;
  let total = 0;
  if (Array.isArray(drives.previous)) {
    drives.previous.forEach((d) => { total += d.plays?.length ?? 0; });
  }
  if (drives.current) total += drives.current.plays?.length ?? 0;
  return total;
}

async function main() {
  log.info("starting plays backfill");

  // Find games with no plays yet
  const { rows: games } = await pool.query(
    `SELECT g.id, g.eventid, g.league, g.hometeamid, g.awayteamid
     FROM games g
     WHERE g.status ILIKE '%final%'
       AND g.eventid IS NOT NULL
       AND g.season = '2024-25'
       AND NOT EXISTS (
         SELECT 1 FROM plays p WHERE p.gameid = g.id
       )
     ORDER BY g.date DESC`,
  );

  log.info({ total: games.length }, "games to backfill");

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (game) => {
        try {
          await processGame(game);
          processed++;
        } catch (err) {
          log.error({ gameId: game.id, err: err.message }, "game backfill failed");
          failed++;
        }
      }),
    );

    if (i + BATCH_SIZE < games.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  log.info({ processed, failed }, "backfill complete");
  await pool.end();
}

main().catch((err) => {
  log.error({ err }, "backfill crashed");
  process.exit(1);
});
