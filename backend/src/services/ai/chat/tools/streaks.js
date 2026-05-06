import pool from "../../../../db/db.js";

// Query the precomputed streak_events table.
// Useful for "longest scoring streak", "active streaks", "his current hot streak", etc.
export async function getStreaks({
  league,
  subjectType,
  subjectId,
  statLabel,
  activeOnly = false,
  minLength,
  limit = 10,
}) {
  if (!league) return { error: "league required" };

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 25);
  const params = [league];
  const where = ["league = $1"];

  if (subjectType) {
    params.push(subjectType);
    where.push(`subject_type = $${params.length}`);
  }
  if (subjectId) {
    params.push(subjectId);
    where.push(`subject_id = $${params.length}`);
  }
  if (statLabel) {
    params.push(statLabel);
    where.push(`stat_label ILIKE '%' || $${params.length} || '%'`);
  }
  if (activeOnly) {
    where.push("is_active = TRUE");
  }
  if (minLength != null) {
    params.push(minLength);
    where.push(`length >= $${params.length}`);
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT se.id, se.subject_type, se.subject_id, se.stat_label, se.length,
            se.start_game_date, se.last_game_date, se.is_active,
            CASE WHEN se.subject_type = 'player' THEN p.name
                 WHEN se.subject_type = 'team' THEN t.name END AS subject_name,
            CASE WHEN se.subject_type = 'player' THEN pt.shortname
                 WHEN se.subject_type = 'team' THEN t.shortname END AS team_short
     FROM streak_events se
     LEFT JOIN players p ON se.subject_type = 'player' AND p.id = se.subject_id
     LEFT JOIN teams pt  ON se.subject_type = 'player' AND pt.id = p.teamid
     LEFT JOIN teams t   ON se.subject_type = 'team' AND t.id = se.subject_id
     WHERE ${where.join(" AND ")}
     ORDER BY se.length DESC, se.last_game_date DESC
     LIMIT $${params.length}`,
    params,
  );

  return { league, streaks: rows };
}
