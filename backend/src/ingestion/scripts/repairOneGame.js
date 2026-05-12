import dotenv from "dotenv";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import logger from "../../logger.js";
import { getEventsByDate } from "../espn/espnAPIClient.js";
import { processEvent } from "../pipeline/eventProcessor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "repairOneGame" });

const EVENT_ID = parseInt(process.argv[2], 10);
const LEAGUE = process.argv[3];

if (!EVENT_ID || !LEAGUE) {
  console.error("usage: node repairOneGame.js <eventId> <league>");
  console.error("example: node repairOneGame.js 401871329 nba");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function main() {
  const { rows } = await pool.query(
    "SELECT id, date, status FROM games WHERE eventid = $1 AND league = $2",
    [EVENT_ID, LEAGUE],
  );
  if (rows.length === 0) {
    log.error({ EVENT_ID, LEAGUE }, "no game found");
    process.exit(1);
  }
  const game = rows[0];
  const dateStr = new Date(game.date).toISOString().slice(0, 10).replace(/-/g, "");
  log.info({ gameId: game.id, dateStr, status: game.status }, "fetching scoreboard");

  const events = await getEventsByDate(dateStr, LEAGUE);
  const event = events.find((e) => parseInt(e.id, 10) === EVENT_ID);
  if (!event) {
    log.error({ EVENT_ID, dateStr }, "event not in scoreboard");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await processEvent(client, LEAGUE, event, { force: true });
    log.info({ EVENT_ID, gameId: game.id }, "processEvent complete");
  } finally {
    client.release();
  }

  const { rows: after } = await pool.query(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END) AS with_points,
            SUM(CASE WHEN minutes IS NOT NULL THEN 1 ELSE 0 END) AS with_minutes
     FROM stats WHERE gameid = $1`,
    [game.id],
  );
  log.info({ ...after[0] }, "stats after repair");
}

main()
  .catch((err) => {
    log.error({ err }, "fatal");
    process.exit(1);
  })
  .finally(() => pool.end());
