import pool from "../../../../db/db.js";

// Query the player_awards table. Supports lookup by player, by season+league,
// or by award type across history.
export async function getPlayerAwards({
  league,
  playerId,
  season,
  awardType,
  limit = 50,
}) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);

  const params = [];
  const where = [];

  if (league) {
    params.push(league);
    where.push(`pa.league = $${params.length}`);
  }
  if (playerId) {
    params.push(playerId);
    where.push(`pa.player_id = $${params.length}`);
  }
  if (season) {
    params.push(season);
    where.push(`pa.season = $${params.length}`);
  }
  if (awardType) {
    params.push(awardType);
    where.push(`pa.award_type ILIKE '%' || $${params.length} || '%'`);
  }

  if (where.length === 0) {
    return { error: "Provide at least one of: league, playerId, season, awardType." };
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT pa.player_id, pl.name AS player_name, pa.league, pa.season,
            pa.award_type, pa.award_name,
            t.shortname AS team
     FROM player_awards pa
     LEFT JOIN players pl ON pl.id = pa.player_id
     LEFT JOIN teams t ON t.id = pl.teamid
     WHERE ${where.join(" AND ")}
     ORDER BY pa.season DESC, pa.award_type ASC
     LIMIT $${params.length}`,
    params,
  );

  return { awards: rows, capped: rows.length === safeLimit };
}
