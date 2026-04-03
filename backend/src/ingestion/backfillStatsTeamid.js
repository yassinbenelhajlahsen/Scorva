import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import logger from "../logger.js";
import { getSportPath } from "./eventProcessor.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const log = logger.child({ worker: "backfillStatsTeamid" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 300;

async function withRetry(fn, { retries = 3, baseDelayMs = 1500, label = "" } = {}) {
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

async function processGame(client, game) {
  const { id: gameId, eventid, league, hometeamid, awayteamid } = game;

  // Look up ESPN team IDs for home and away
  const teamRes = await client.query(
    "SELECT id, espnid FROM teams WHERE id = ANY($1::int[])",
    [[hometeamid, awayteamid]]
  );
  const teamById = Object.fromEntries(teamRes.rows.map((t) => [t.id, t.espnid]));
  const homeEspnId = String(teamById[hometeamid]);
  const awayEspnId = String(teamById[awayteamid]);

  // Fetch ESPN boxscore
  const sport = getSportPath(league);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventid}`;

  let resp;
  try {
    resp = await withRetry(() => axios.get(url), {
      retries: 3,
      baseDelayMs: 2000,
      label: `backfill:${league}:${eventid}`,
    });
  } catch (err) {
    log.warn({ gameId, eventid, league }, "ESPN fetch failed, skipping game");
    return 0;
  }

  const playerGroups = resp.data.boxscore?.players || [];
  let updated = 0;

  for (const group of playerGroups) {
    const espnGroupTeamId = String(group.team.id);
    const dbTeamId =
      espnGroupTeamId === homeEspnId
        ? hometeamid
        : espnGroupTeamId === awayEspnId
          ? awayteamid
          : null;

    if (dbTeamId === null) {
      log.warn({ gameId, espnGroupTeamId, homeEspnId, awayEspnId }, "unrecognised team group, skipping");
      continue;
    }

    const statCategories = group.statistics || [];
    for (const cat of statCategories) {
      const athletes = cat.athletes || [];
      for (const athleteEntry of athletes) {
        const espnPlayerId = athleteEntry.athlete?.id;
        if (!espnPlayerId) continue;

        // Look up DB player
        const playerRes = await client.query(
          "SELECT id FROM players WHERE espn_playerid = $1 AND league = $2",
          [espnPlayerId, league]
        );
        if (playerRes.rows.length === 0) continue;

        const dbPlayerId = playerRes.rows[0].id;

        const res = await client.query(
          "UPDATE stats SET teamid = $1 WHERE gameid = $2 AND playerid = $3 AND teamid IS NULL",
          [dbTeamId, gameId, dbPlayerId]
        );
        updated += res.rowCount;
      }
    }
  }

  return updated;
}

async function run() {
  const client = await pool.connect();
  try {
    // Find all games that still have stats rows with NULL teamid
    const gamesRes = await client.query(`
      SELECT DISTINCT g.id, g.eventid, g.league, g.hometeamid, g.awayteamid
      FROM games g
      JOIN stats s ON s.gameid = g.id
      WHERE s.teamid IS NULL AND g.eventid IS NOT NULL
      ORDER BY g.id
    `);

    const games = gamesRes.rows;
    log.info({ total: games.length }, "games with NULL stat teamids");

    if (games.length === 0) {
      log.info("nothing to backfill");
      return;
    }

    let totalUpdated = 0;
    let processed = 0;

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map((game) => processGame(client, game)));
      const batchUpdated = results.reduce((s, n) => s + n, 0);
      totalUpdated += batchUpdated;
      processed += batch.length;

      if (processed % 100 === 0 || processed === games.length) {
        log.info({ processed, total: games.length, totalUpdated }, "progress");
      }

      if (i + BATCH_SIZE < games.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    log.info({ totalUpdated, processed }, "backfill complete");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  log.error({ err }, "backfill failed");
  process.exit(1);
});
