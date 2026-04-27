import pool from "../../db/db.js";

const ABBR_MAX_LEN = 4;
const SUBSTRING_MIN_LEN = 3;
const FUZZY_THRESHOLD = 0.3;

function buildLeagueClause(league, paramIndex) {
  return league
    ? { sql: ` AND league = $${paramIndex}`, params: [league] }
    : { sql: "", params: [] };
}

async function runTier(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function resolveTeams(token, { league } = {}) {
  if (typeof token !== "string" || !token.trim()) return [];
  const trimmed = token.trim();

  // Tier 1: abbreviation (only short tokens)
  if (trimmed.length <= ABBR_MAX_LEN) {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE LOWER(abbreviation) = LOWER($1)
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 1 }));
  }

  // Tier 2: exact match on shortname or name
  {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) = LOWER($1) OR LOWER(name) = LOWER($1))
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 2 }));
  }

  // Tier 3: prefix
  {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) LIKE LOWER($1) || '%' OR LOWER(name) LIKE LOWER($1) || '%')
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 3 }));
  }

  // Tier 4: substring (length-3 gate)
  if (trimmed.length >= SUBSTRING_MIN_LEN) {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) LIKE '%' || LOWER($1) || '%' OR LOWER(name) LIKE '%' || LOWER($1) || '%')
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 4 }));
  }

  // Tier 5: fuzzy (trigram)
  {
    const lc = buildLeagueClause(league, 3);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (similarity(shortname, $1) > $2 OR similarity(name, $1) > $2)
        AND conf IS NOT NULL${lc.sql}
      ORDER BY GREATEST(similarity(shortname, $1), similarity(name, $1)) DESC
    `;
    const rows = await runTier(sql, [trimmed, FUZZY_THRESHOLD, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 5 }));
  }

  return [];
}
