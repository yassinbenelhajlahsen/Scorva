import logger from "../logger.js";

const log = logger.child({ worker: "streakEvents" });

const PLAYER_STATS_BY_LEAGUE = {
  nba: [
    { label: "double-double",  expr: "(s.points >= 10 AND s.rebounds >= 10)" },
    { label: "triple-double",  expr: "(s.points >= 10 AND s.rebounds >= 10 AND s.assists >= 10)" },
    { label: "30+ point",      expr: "(s.points >= 30)" },
    { label: "20+ point",      expr: "(s.points >= 20)" },
    { label: "10+ rebound",    expr: "(s.rebounds >= 10)" },
    { label: "10+ assist",     expr: "(s.assists >= 10)" },
  ],
  nfl: [
    { label: "100+ yard",      expr: "(s.cmpatt IS NULL  AND s.yds >= 100)" },
    { label: "2+ TD",          expr: "(s.cmpatt IS NULL  AND s.td  >= 2)" },
    { label: "250+ pass yard", expr: "(s.cmpatt IS NOT NULL AND s.yds >= 250)" },
    { label: "2+ pass TD",     expr: "(s.cmpatt IS NOT NULL AND s.td  >= 2)" },
  ],
  nhl: [
    { label: "multi-point",    expr: "((s.g + s.a) >= 2)" },
    { label: "goal",           expr: "(s.g >= 1)" },
  ],
};

const PLAYER_THRESHOLD = { nba: 4, nfl: 3, nhl: 3 };
const TEAM_THRESHOLD = { nba: 3, nfl: 3, nhl: 3 };

const RECENT_WINDOW_DAYS = 60;

function buildPlayerScanSQL(statExpr, label) {
  return `
    -- streak label: ${label}
    WITH recent AS (
      SELECT s.playerid AS subject_id,
             g.date,
             ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
             ${statExpr} AS meets
      FROM stats s
      JOIN games g ON g.id = s.gameid
      JOIN players p ON p.id = s.playerid
      WHERE p.league = $1
        AND g.type IN ('regular','makeup','playoff')
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
    ),
    streaks AS (
      SELECT subject_id,
             LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT meets) - 1, COUNT(*)), COUNT(*))::int AS length,
             BOOL_AND(meets) FILTER (WHERE rn = 1) AS most_recent_ok,
             MAX(date)       FILTER (WHERE rn = 1) AS last_game_date
      FROM recent
      GROUP BY subject_id
    )
    SELECT s.subject_id,
           s.length,
           r.date AS start_game_date,
           s.last_game_date
    FROM streaks s
    JOIN recent r ON r.subject_id = s.subject_id AND r.rn = s.length
    WHERE s.length >= $2
      AND s.most_recent_ok = TRUE
  `;
}

async function scanPlayerStreaks(client, league) {
  const stats = PLAYER_STATS_BY_LEAGUE[league] || [];
  const threshold = PLAYER_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const { label, expr } of stats) {
    const sql = buildPlayerScanSQL(expr, label);
    const { rows } = await client.query(sql, [league, threshold]);
    for (const row of rows) {
      out.push({
        subject_type: "player",
        subject_id: row.subject_id,
        stat_label: label,
        length: row.length,
        start_game_date: row.start_game_date,
        last_game_date: row.last_game_date,
      });
    }
  }
  return out;
}

function buildTeamScanSQL(outcomeCol /* 'won' | 'lost' */, statLabel) {
  return `
    -- streak label: ${statLabel}
    -- ties (homescore <> awayscore) are filtered out below
    WITH team_games AS (
      SELECT g.hometeamid AS team_id, g.date,
             (g.homescore > g.awayscore) AS won,
             (g.homescore < g.awayscore) AS lost
      FROM games g
      JOIN teams t ON t.id = g.hometeamid
      WHERE t.league = $1
        AND g.type IN ('regular','makeup','playoff')
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
        AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
        AND g.homescore <> g.awayscore
      UNION ALL
      SELECT g.awayteamid, g.date,
             (g.awayscore > g.homescore),
             (g.awayscore < g.homescore)
      FROM games g
      JOIN teams t ON t.id = g.awayteamid
      WHERE t.league = $1
        AND g.type IN ('regular','makeup','playoff')
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
        AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
        AND g.homescore <> g.awayscore
    ),
    ranked AS (
      SELECT team_id, date, won, lost,
             ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY date DESC) AS rn
      FROM team_games
    ),
    streaks AS (
      SELECT team_id,
             LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT ${outcomeCol}) - 1, COUNT(*)), COUNT(*))::int AS length,
             BOOL_AND(${outcomeCol}) FILTER (WHERE rn = 1) AS most_recent_ok,
             MAX(date) FILTER (WHERE rn = 1) AS last_game_date
      FROM ranked
      GROUP BY team_id
    )
    SELECT s.team_id        AS subject_id,
           '${statLabel}'   AS stat_label,
           s.length,
           r.date           AS start_game_date,
           s.last_game_date
    FROM streaks s
    JOIN ranked r ON r.team_id = s.team_id AND r.rn = s.length
    WHERE s.length >= $2 AND s.most_recent_ok = TRUE
  `;
}

async function scanTeamStreaks(client, league) {
  const threshold = TEAM_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const [outcomeCol, label] of [["won", "win"], ["lost", "loss"]]) {
    const sql = buildTeamScanSQL(outcomeCol, label);
    const { rows } = await client.query(sql, [league, threshold]);
    for (const row of rows) {
      out.push({
        subject_type: "team",
        subject_id: row.subject_id,
        stat_label: row.stat_label,
        length: row.length,
        start_game_date: row.start_game_date,
        last_game_date: row.last_game_date,
      });
    }
  }
  return out;
}

async function upsertActiveRows(client, league, active) {
  if (active.length === 0) return;
  const cols = ["league", "subject_type", "subject_id", "stat_label", "length", "start_game_date", "last_game_date"];
  const valuesSQL = active
    .map((_, i) => {
      const base = i * cols.length;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
    })
    .join(",");
  const params = [];
  for (const r of active) {
    params.push(league, r.subject_type, r.subject_id, r.stat_label, r.length, r.start_game_date, r.last_game_date);
  }
  const sql = `
    INSERT INTO streak_events (
      league, subject_type, subject_id, stat_label, length, start_game_date, last_game_date
    )
    VALUES ${valuesSQL}
    ON CONFLICT (subject_type, subject_id, stat_label, start_game_date) DO UPDATE SET
      length         = EXCLUDED.length,
      last_game_date = EXCLUDED.last_game_date,
      is_active      = TRUE,
      updated_at     = NOW()
  `;
  await client.query(sql, params);
}

async function deactivateMissing(client, league, active) {
  await client.query(`
    CREATE TEMP TABLE active_now (
      subject_type    VARCHAR(10),
      subject_id      INT,
      stat_label      VARCHAR(40),
      start_game_date DATE
    ) ON COMMIT DROP
  `);
  if (active.length > 0) {
    const valuesSQL = active
      .map((_, i) => {
        const base = i * 4;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
      })
      .join(",");
    const params = [];
    for (const r of active) {
      params.push(r.subject_type, r.subject_id, r.stat_label, r.start_game_date);
    }
    await client.query(
      `INSERT INTO active_now (subject_type, subject_id, stat_label, start_game_date) VALUES ${valuesSQL}`,
      params,
    );
  }
  await client.query(
    `
    UPDATE streak_events se
    SET is_active = FALSE, updated_at = NOW()
    WHERE se.league = $1
      AND se.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM active_now a
        WHERE a.subject_type    = se.subject_type
          AND a.subject_id      = se.subject_id
          AND a.stat_label      = se.stat_label
          AND a.start_game_date = se.start_game_date
      )
    `,
    [league],
  );
}

export async function updateStreakEvents(pool, league) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const players = await scanPlayerStreaks(client, league);
    const teams   = await scanTeamStreaks(client, league);
    const active  = [...players, ...teams];
    await upsertActiveRows(client, league, active);
    await deactivateMissing(client, league, active);
    await client.query("COMMIT");
    log.info({ league, active: active.length }, "streak events updated");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}
