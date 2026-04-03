import pool from "../db/db.js";
import { tryParseDate } from "../utils/dateParser.js";

const SEARCH_QUERY = `
WITH raw_results AS (
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE p.name ILIKE $1
  )
  UNION ALL
  (
    SELECT id, name, league, logo_url AS "imageUrl", shortname, NULL::date AS date, 'team' AS type,
           NULL AS position, NULL AS team_name
    FROM teams
    WHERE name ILIKE $1 OR shortname ILIKE $1
  )
  UNION ALL
  (
    SELECT g.id,
           CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
           g.league,
           NULL AS "imageUrl",
           NULL AS shortname,
           g.date,
           'game' AS type,
           NULL AS position,
           NULL AS team_name
    FROM games g
    JOIN teams ht ON g.hometeamid = ht.id
    JOIN teams at ON g.awayteamid = at.id
    WHERE ht.name ILIKE $1 OR at.name ILIKE $1
       OR ht.shortname ILIKE $1 OR at.shortname ILIKE $1
       OR CONCAT(ht.shortname, ' vs ', at.shortname) ILIKE $1
       OR CONCAT(ht.name, ' vs ', at.name) ILIKE $1
       OR ($3::date IS NOT NULL AND g.date = $3::date)
  )
)
SELECT id, name, league, "imageUrl", shortname, date, type, position, team_name
FROM raw_results
ORDER BY
  CASE
    WHEN LOWER(COALESCE(shortname, name)) = LOWER($2)                 THEN 0
    WHEN LOWER(COALESCE(shortname, name)) LIKE LOWER($2) || '%'       THEN 1
    WHEN LOWER(COALESCE(shortname, name)) LIKE '%' || LOWER($2) || '%' THEN 2
    ELSE 3
  END ASC,
  CASE type WHEN 'team' THEN 3 WHEN 'player' THEN 2 WHEN 'game' THEN 1 END DESC,
  similarity(COALESCE(shortname, name), $2) DESC,
  CASE WHEN type = 'game' THEN date END ASC,
  LOWER(COALESCE(shortname, name)) ASC
LIMIT 15;
`;

// Fires only when the main ILIKE query returns 0 results
const FUZZY_QUERY = `
WITH fuzzy AS (
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE similarity(p.name, $1) > 0.3
  )
  UNION ALL
  (
    SELECT id, name, league, logo_url AS "imageUrl", shortname, NULL::date AS date, 'team' AS type,
           NULL AS position, NULL AS team_name
    FROM teams
    WHERE similarity(name, $1) > 0.3
  )
)
SELECT id, name, league, "imageUrl", shortname, date, type, position, team_name
FROM fuzzy
ORDER BY similarity(COALESCE(shortname, name), $1) DESC
LIMIT 15;
`;

export async function search(term) {
  const sanitizedTerm = term.trim();
  if (!sanitizedTerm || sanitizedTerm.length > 200) return [];
  const escapedTerm = sanitizedTerm.replace(/[%_\\]/g, "\\$&");
  const result = await pool.query(SEARCH_QUERY, [
    `%${escapedTerm}%`,
    escapedTerm,
    tryParseDate(sanitizedTerm),
  ]);
  if (result.rows.length > 0) return result.rows;

  // Fuzzy fallback: catches typos when no substring match found
  const fuzzy = await pool.query(FUZZY_QUERY, [sanitizedTerm]);
  return fuzzy.rows;
}
