import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

const apply = process.argv.includes("--apply");
const badTeamIds = [
  5740, 24394, 24400, 26858, 177321, 177322, 268263, 268264, 268265, 268266,
  268269,
];
const connectionString = process.env.DATABASE_URL || process.env.DB_URL;

if (typeof connectionString !== "string" || !connectionString.trim()) {
  console.error(
    "Missing DATABASE_URL/DB_URL. Set it in backend/.env (or repo .env) and retry.",
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const previewQuery = `
WITH suspect_teams AS (
  SELECT id
  FROM teams
  WHERE id = ANY($1::int[])
),
impacted_players AS (
  SELECT p.id, p.league
  FROM players p
  WHERE p.teamid IN (SELECT id FROM suspect_teams)
),
player_fallback_team AS (
  SELECT
    ip.id AS player_id,
    (
      SELECT CASE
        WHEN g.hometeamid NOT IN (SELECT id FROM suspect_teams) THEN g.hometeamid
        WHEN g.awayteamid NOT IN (SELECT id FROM suspect_teams) THEN g.awayteamid
        ELSE NULL
      END
      FROM stats s
      JOIN games g ON g.id = s.gameid
      WHERE s.playerid = ip.id
        AND g.league = ip.league
        AND (
          g.hometeamid NOT IN (SELECT id FROM suspect_teams)
          OR g.awayteamid NOT IN (SELECT id FROM suspect_teams)
        )
      ORDER BY g.date DESC, g.id DESC
      LIMIT 1
    ) AS fallback_teamid
  FROM impacted_players ip
)
SELECT
  (SELECT count(*) FROM suspect_teams) AS teams_to_delete,
  (SELECT count(*) FROM games WHERE hometeamid IN (SELECT id FROM suspect_teams) OR awayteamid IN (SELECT id FROM suspect_teams)) AS games_to_delete,
  (SELECT count(*) FROM stats WHERE gameid IN (
     SELECT id FROM games WHERE hometeamid IN (SELECT id FROM suspect_teams) OR awayteamid IN (SELECT id FROM suspect_teams)
  )) AS stats_to_delete,
  (SELECT count(*) FROM player_fallback_team WHERE fallback_teamid IS NOT NULL) AS players_reassigned,
  (SELECT count(*) FROM player_fallback_team WHERE fallback_teamid IS NULL) AS players_set_null;
`;

const createTempTeamsQuery = `
CREATE TEMP TABLE tmp_suspect_teams AS
SELECT t.id
FROM teams t
WHERE t.id = ANY($1::int[]);
`;

const reassignPlayersQuery = `
WITH impacted_players AS (
  SELECT p.id, p.league
  FROM players p
  WHERE p.teamid IN (SELECT id FROM tmp_suspect_teams)
),
player_fallback_team AS (
  SELECT
    ip.id AS player_id,
    (
      SELECT CASE
        WHEN g.hometeamid NOT IN (SELECT id FROM tmp_suspect_teams) THEN g.hometeamid
        WHEN g.awayteamid NOT IN (SELECT id FROM tmp_suspect_teams) THEN g.awayteamid
        ELSE NULL
      END
      FROM stats s
      JOIN games g ON g.id = s.gameid
      WHERE s.playerid = ip.id
        AND g.league = ip.league
        AND (
          g.hometeamid NOT IN (SELECT id FROM tmp_suspect_teams)
          OR g.awayteamid NOT IN (SELECT id FROM tmp_suspect_teams)
        )
      ORDER BY g.date DESC, g.id DESC
      LIMIT 1
    ) AS fallback_teamid
  FROM impacted_players ip
)
UPDATE players p
SET teamid = pft.fallback_teamid
FROM player_fallback_team pft
WHERE p.id = pft.player_id;
`;

const nullRemainingPlayersQuery = `
UPDATE players
SET teamid = NULL
WHERE teamid IN (SELECT id FROM tmp_suspect_teams);
`;

const deleteStatsQuery = `
DELETE FROM stats
WHERE gameid IN (
  SELECT g.id
  FROM games g
  WHERE g.hometeamid IN (SELECT id FROM tmp_suspect_teams)
     OR g.awayteamid IN (SELECT id FROM tmp_suspect_teams)
);
`;

const deleteGamesQuery = `
DELETE FROM games
WHERE hometeamid IN (SELECT id FROM tmp_suspect_teams)
   OR awayteamid IN (SELECT id FROM tmp_suspect_teams);
`;

const deleteTeamsQuery = `
DELETE FROM teams
WHERE id IN (SELECT id FROM tmp_suspect_teams);
`;

const dropTempTeamsQuery = `
DROP TABLE tmp_suspect_teams;
`;

const client = await pool.connect();
try {
  const preview = await client.query(previewQuery, [badTeamIds]);
  const impact = preview.rows[0];
  console.log("Planned impact:", impact);

  await client.query("BEGIN");
  try {
    await client.query(createTempTeamsQuery, [badTeamIds]);
    await client.query(reassignPlayersQuery);
    await client.query(nullRemainingPlayersQuery);
    await client.query(deleteStatsQuery);
    await client.query(deleteGamesQuery);
    await client.query(deleteTeamsQuery);
    await client.query(dropTempTeamsQuery);

    if (apply) {
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
  } catch (txErr) {
    await client.query("ROLLBACK");
    throw txErr;
  }

  console.log(
    apply
      ? "Applied successfully (COMMIT)."
      : "Dry run complete (ROLLBACK).",
  );
} catch (err) {
  console.error("Failed to run special-event fix script:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
