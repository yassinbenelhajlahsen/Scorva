import pool from "../db/db.js";
import { tryParseDate } from "../utils/dateParser.js";

const SEARCH_QUERY = `
WITH latest_seasons AS (
  SELECT DISTINCT ON (league) league, season
  FROM games
  ORDER BY league, season DESC
),
matching_teams AS (
  SELECT id FROM teams WHERE (name ILIKE $1 OR shortname ILIKE $1) AND conf IS NOT NULL
),
raw_results AS (
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE p.name ILIKE $1
  )
  UNION ALL
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM player_aliases pa
    JOIN players p ON pa.player_id = p.id
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE pa.alias ILIKE $1
  )
  UNION ALL
  (
    SELECT id, name, league, logo_url AS "imageUrl", shortname, NULL::date AS date, 'team' AS type,
           NULL AS position, NULL AS team_name, NULL::int AS popularity
    FROM teams
    WHERE (name ILIKE $1 OR shortname ILIKE $1)
      AND conf IS NOT NULL
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
           NULL AS team_name,
           NULL::int AS popularity
    FROM latest_seasons ls
    JOIN games g ON g.league = ls.league AND g.season = ls.season
    JOIN teams ht ON g.hometeamid = ht.id
    JOIN teams at ON g.awayteamid = at.id
    WHERE (g.hometeamid IN (SELECT id FROM matching_teams)
        OR g.awayteamid IN (SELECT id FROM matching_teams)
        OR ($3::date IS NOT NULL AND g.date = $3::date))
      AND ht.conf IS NOT NULL AND at.conf IS NOT NULL
  )
),
deduped AS (
  SELECT DISTINCT ON (type, id) *
  FROM raw_results
  ORDER BY type, id,
    CASE
      WHEN LOWER(COALESCE(shortname, name)) = LOWER($2)                  THEN 0
      WHEN LOWER(COALESCE(shortname, name)) LIKE LOWER($2) || '%'        THEN 1
      WHEN LOWER(COALESCE(shortname, name)) LIKE '%' || LOWER($2) || '%' THEN 2
      ELSE 3
    END ASC
)
SELECT id, name, league, "imageUrl", shortname, date, type, position, team_name
FROM deduped
ORDER BY
  CASE
    WHEN LOWER(COALESCE(shortname, name)) = LOWER($2)                  THEN 0
    WHEN LOWER(COALESCE(shortname, name)) LIKE LOWER($2) || '%'        THEN 1
    WHEN LOWER(COALESCE(shortname, name)) LIKE '%' || LOWER($2) || '%' THEN 2
    ELSE 3
  END ASC,
  CASE type WHEN 'team' THEN 3 WHEN 'player' THEN 2 WHEN 'game' THEN 1 END DESC,
  COALESCE(popularity, 0) DESC,
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
           p.position, t.name AS team_name, p.popularity
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE similarity(p.name, $1) > 0.3
  )
  UNION ALL
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM player_aliases pa
    JOIN players p ON pa.player_id = p.id
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE similarity(pa.alias, $1) > 0.3
  )
  UNION ALL
  (
    SELECT id, name, league, logo_url AS "imageUrl", shortname, NULL::date AS date, 'team' AS type,
           NULL AS position, NULL AS team_name, NULL::int AS popularity
    FROM teams
    WHERE similarity(name, $1) > 0.3
      AND conf IS NOT NULL
  )
),
deduped AS (
  SELECT DISTINCT ON (type, id) *
  FROM fuzzy
  ORDER BY type, id, similarity(COALESCE(shortname, name), $1) DESC
)
SELECT id, name, league, "imageUrl", shortname, date, type, position, team_name
FROM deduped
ORDER BY similarity(COALESCE(shortname, name), $1) DESC, COALESCE(popularity, 0) DESC
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
