import pool from "../db/db.js";
import logger from "../logger.js";

// Must match frontend slugify() exactly — divergence breaks slug-{id} suffix verification.
export function nameToSlug(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export const SLUG_SQL = "LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^A-Za-z0-9_\\s-]', '', 'g'), '\\s+', '-', 'g'))";

export async function getPlayerIdBySlug(slugOrId, league) {
  try {
    const s = String(slugOrId).trim();

    if (/^\d+$/.test(s)) return parseInt(s, 10);

    const suffixMatch = s.match(/^(.+)-(\d+)$/);
    if (suffixMatch) {
      const [, prefix, idStr] = suffixMatch;
      const candidateId = parseInt(idStr, 10);
      const byId = await pool.query(
        `SELECT id, name FROM players WHERE id = $1 AND league = $2`,
        [candidateId, league]
      );
      const row = byId.rows[0];
      if (row && nameToSlug(row.name) === prefix) {
        return row.id;
      }
    }

    const result = await pool.query(
      `SELECT id
         FROM players
        WHERE league = $1
          AND ${SLUG_SQL} = $2
        ORDER BY id ASC
        LIMIT 1`,
      [league, s.toLowerCase()]
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    logger.error({ err }, "Error looking up player by slug");
    return null;
  }
}
