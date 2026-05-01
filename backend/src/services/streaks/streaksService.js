import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { PLAYER_TIER, tierCaseSql } from "./streakTiers.js";

const TTL_SECONDS = 60;

function buildSql(subjectType, league) {
  const orderBy =
    subjectType === "player"
      ? `${tierCaseSql(PLAYER_TIER[league] ?? [], "stat_label")} ASC, length DESC`
      : "length DESC";
  return `
    SELECT stat_label, length
    FROM streak_events
    WHERE league = $1 AND subject_type = $2 AND subject_id = $3
      AND is_active = TRUE
    ORDER BY ${orderBy}
    LIMIT 1
  `;
}

export async function getActiveStreak(league, subjectType, subjectId) {
  if (subjectType !== "player" && subjectType !== "team") {
    throw new Error(`Invalid subjectType: ${subjectType}`);
  }
  return cached(
    `streak:${league}:${subjectType}:${subjectId}`,
    TTL_SECONDS,
    async () => {
      const sql = buildSql(subjectType, league);
      const { rows } = await pool.query(sql, [league, subjectType, subjectId]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return { length: row.length, statLabel: row.stat_label, subjectType };
    },
  );
}
