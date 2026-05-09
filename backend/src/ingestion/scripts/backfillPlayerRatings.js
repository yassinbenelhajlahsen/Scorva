import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import logger from "../../logger.js";
import upsertPlays from "../upsert/upsertPlays.js";
import upsertPlayParticipants from "../upsert/upsertPlayParticipants.js";
import { recomputeGame } from "../../services/games/ratingEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillPlayerRatings" });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10000,
    keepAlive: true,
  });
  // Idle clients can be dropped by NAT/firewalls during long backfills; swallow
  // the error so the run continues — the next acquire will get a fresh client.
  pool.on("error", (err) => {
    log.warn({ err: err.message }, "idle pg client error (suppressed)");
  });

  // Pick current NBA season from games (latest games row for nba).
  const { rows: seasonRows } = await pool.query(
    `SELECT DISTINCT season FROM games WHERE league = 'nba' AND season IS NOT NULL
     ORDER BY season DESC LIMIT 1`,
  );
  if (seasonRows.length === 0) {
    log.warn("no NBA season found; nothing to backfill");
    await pool.end();
    return;
  }
  const season = seasonRows[0].season;
  log.info({ season }, "backfilling NBA player ratings");

  const { rows: games } = await pool.query(
    `SELECT g.id, g.eventid, g.hometeamid, g.awayteamid,
            ht.espnid AS home_espn_id, at.espnid AS away_espn_id
       FROM games g
       LEFT JOIN teams ht ON ht.id = g.hometeamid
       LEFT JOIN teams at ON at.id = g.awayteamid
      WHERE g.league = 'nba' AND g.season = $1
        AND g.status ILIKE '%final%'
        AND g.eventid IS NOT NULL
      ORDER BY g.date ASC`,
    [season],
  );
  log.info({ count: games.length }, "Final NBA games to backfill");

  let ok = 0, fail = 0;
  for (const g of games) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${g.eventid}`;
    let data;
    try {
      const resp = await axios.get(url, { timeout: 15000 });
      data = resp.data;
    } catch (err) {
      log.warn({ err: err.message, gameId: g.id, eventid: g.eventid }, "ESPN fetch failed, skipping");
      fail++;
      continue;
    }
    let client;
    try {
      client = await pool.connect();
      // Suppress 'error' events from this client (e.g. idle disconnects between
      // statements) so they don't crash the process.
      client.on("error", (err) => {
        log.warn({ err: err.message, gameId: g.id }, "pg client error (suppressed)");
      });
      await client.query("BEGIN");
      await upsertPlays(
        client, g.id, data, "nba",
        g.hometeamid, g.awayteamid,
        g.home_espn_id, g.away_espn_id,
      );
      await upsertPlayParticipants(client, g.id, data, "nba");
      await recomputeGame(client, g.id);
      await client.query("COMMIT");
      ok++;
      if (ok % 25 === 0) log.info({ ok, fail }, "progress");
    } catch (err) {
      try { if (client) await client.query("ROLLBACK"); } catch { /* ignore */ }
      log.error({ err: err.message, gameId: g.id }, "backfill failed for game");
      fail++;
    } finally {
      try { if (client) client.release(); } catch { /* ignore */ }
    }
    // Be polite to ESPN — small delay between games.
    await new Promise((r) => setTimeout(r, 250));
  }

  log.info({ ok, fail }, "backfill complete");
  await pool.end();
}

if (resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    log.error({ err }, "fatal");
    process.exit(1);
  });
}

export { main };
