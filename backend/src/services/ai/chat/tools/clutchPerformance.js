import pool from "../../../../db/db.js";

// Per-player clutch scoring derived from plays table.
// IMPORTANT CAVEAT: plays for Final games retain ONLY scoring plays. We can answer
// "how often did he score in the clutch" but NOT "his clutch FG%" historically.
// Live games retain all plays, so that question can be answered for in-progress games.
//
// Clutch window:
//   NBA: last 5:00 of period 4 or any OT period, score within 5
//   NHL: last 5:00 of period 3 or any OT/SO, score within 1
//   NFL: last 5:00 of quarter 4 or OT, score within 8

const LEAGUE_CONFIG = {
  nba: { lastPeriod: 4, marginCap: 5 },
  nhl: { lastPeriod: 3, marginCap: 1 },
  nfl: { lastPeriod: 4, marginCap: 8 },
};

// Clock filter: ESPN clocks like "M:SS" or sub-minute "S.s" — match strings whose
// first numeric token is < 5 (minutes), OR contain no colon (sub-minute).
const CLOCK_LT_5_SQL = `(
  p.clock IS NULL
  OR p.clock NOT LIKE '%:%'
  OR CAST(split_part(p.clock, ':', 1) AS INT) < 5
)`;

export async function getClutchPerformance({
  league,
  playerId,
  seasonStart,
  seasonEnd,
  season,
  limit = 50,
}) {
  const cfg = LEAGUE_CONFIG[league];
  if (!cfg) return { error: `Invalid league: ${league}` };
  if (!playerId) return { error: "playerId required" };

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);

  // Get player name first to filter description (plays.description references player names)
  const playerRes = await pool.query("SELECT name FROM players WHERE id = $1", [playerId]);
  if (!playerRes.rows[0]) return { error: "Player not found" };
  const playerName = playerRes.rows[0].name;
  const lastName = playerName.split(" ").slice(-1)[0];

  const params = [league, `%${lastName}%`, cfg.lastPeriod, cfg.marginCap];
  const where = [
    "g.league = $1",
    "g.status ILIKE 'Final%'",
    "p.scoring_play = TRUE",
    "p.description ILIKE $2",
    "p.period >= $3",
    "ABS(COALESCE(p.home_score, 0) - COALESCE(p.away_score, 0)) <= $4",
    CLOCK_LT_5_SQL,
  ];

  if (season) {
    params.push(season);
    where.push(`g.season = $${params.length}`);
  } else {
    if (seasonStart) {
      params.push(seasonStart);
      where.push(`g.season >= $${params.length}`);
    }
    if (seasonEnd) {
      params.push(seasonEnd);
      where.push(`g.season <= $${params.length}`);
    }
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT g.id AS game_id, g.date, g.season,
            ht.shortname AS home, at.shortname AS away,
            g.homescore, g.awayscore,
            p.period, p.clock, p.description, p.home_score, p.away_score
     FROM plays p
     JOIN games g ON g.id = p.gameid
     JOIN teams ht ON ht.id = g.hometeamid
     JOIN teams at ON at.id = g.awayteamid
     WHERE ${where.join(" AND ")}
     ORDER BY g.date DESC, p.sequence ASC
     LIMIT $${params.length}`,
    params,
  );

  return {
    league,
    playerId,
    playerName,
    clutchWindow: `last 5:00 of period ${cfg.lastPeriod} or OT, within ${cfg.marginCap} pts/goals`,
    plays: rows,
    capped: rows.length === safeLimit,
    caveat:
      "Once a game is marked Final, only scoring plays are retained. Non-scoring clutch attempts (missed shots, turnovers) are NOT in this data — clutch FG% cannot be computed for completed games. Filter is name-based, so namesakes may produce false positives.",
  };
}
