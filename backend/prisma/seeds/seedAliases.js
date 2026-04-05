import dotenv from "dotenv";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const aliases = JSON.parse(
  readFileSync(resolve(__dirname, "player_aliases.json"), "utf8"),
);

let inserted = 0;
let skipped = 0;
let notFound = 0;

for (const entry of aliases) {
  const playerRes = await pool.query(
    "SELECT id FROM players WHERE espn_playerid = $1 AND league = $2",
    [entry.espn_playerid, entry.league],
  );

  if (playerRes.rows.length === 0) {
    console.warn(
      `Player not found: espn_playerid=${entry.espn_playerid} league=${entry.league}`,
    );
    notFound++;
    continue;
  }

  const playerId = playerRes.rows[0].id;

  for (const alias of entry.aliases) {
    const res = await pool.query(
      `INSERT INTO player_aliases (player_id, alias)
       VALUES ($1, $2)
       ON CONFLICT (player_id, alias) DO NOTHING`,
      [playerId, alias],
    );
    if (res.rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }
}

console.log(`Done: ${inserted} inserted, ${skipped} already existed, ${notFound} players not found`);
await pool.end();
