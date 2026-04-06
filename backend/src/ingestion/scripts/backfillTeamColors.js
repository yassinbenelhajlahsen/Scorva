/**
 * One-time script: populate teams.primary_color from ESPN's teams API.
 *
 * ESPN endpoint: /apis/site/v2/sports/{sport}/{league}/teams?limit=100
 * Each team object has a `color` field (6-char hex, no #).
 *
 * Usage: node src/ingestion/backfillTeamColors.js
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import logger from "../../logger.js";
import { getSportPath } from "../eventProcessor.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillTeamColors" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const LEAGUES = ["nba", "nfl", "nhl"];

async function fetchEspnTeams(league) {
  const sport = getSportPath(league);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=100`;
  const resp = await axios.get(url, { timeout: 10000 });
  return resp.data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
}

async function backfill() {
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const league of LEAGUES) {
    log.info({ league }, "fetching teams from ESPN");

    let espnTeams;
    try {
      espnTeams = await fetchEspnTeams(league);
    } catch (err) {
      log.error({ err, league }, "failed to fetch ESPN teams — skipping league");
      continue;
    }

    log.info({ league, count: espnTeams.length }, "ESPN teams fetched");

    for (const entry of espnTeams) {
      const team = entry.team;
      if (!team?.id || !team?.color) {
        totalSkipped++;
        continue;
      }

      const espnId = parseInt(team.id, 10);
      const color = `#${team.color}`;

      const result = await pool.query(
        `UPDATE teams SET primary_color = $1
         WHERE espnid = $2 AND league = $3 AND (primary_color IS NULL OR primary_color != $1)`,
        [color, espnId, league]
      );

      if (result.rowCount > 0) {
        log.info({ league, espnId, name: team.displayName, color }, "updated");
        totalUpdated++;
      } else {
        totalSkipped++;
      }
    }
  }

  log.info({ totalUpdated, totalSkipped }, "backfill complete");
}

backfill()
  .then(() => pool.end())
  .catch(async (err) => {
    log.error({ err }, "backfill failed");
    await pool.end();
    process.exit(1);
  });
