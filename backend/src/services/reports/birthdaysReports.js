import pool from "../../db/db.js";
import logger from "../../logger.js";
import { getCurrentSeason } from "../../cache/seasons.js";

const log = logger.child({ module: "birthdaysReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

// dob is stored as "DD/M/YYYY" (e.g. "14/9/1989"). We parse with TO_DATE using
// the 'DD/MM/YYYY' mask (works for both single- and double-digit months/days).
// The backward 30-day window excludes future dates and spans one rolling month.
// $1 = league, $2 = currentSeason — active players only (at least one stat in the current season).
const QUERY = `
  WITH parsed AS (
    SELECT
      id,
      name,
      image_url,
      dob,
      TO_DATE(dob, 'DD/MM/YYYY')         AS dob_date,
      EXTRACT(MONTH FROM TO_DATE(dob, 'DD/MM/YYYY')) AS m,
      EXTRACT(DAY   FROM TO_DATE(dob, 'DD/MM/YYYY')) AS d,
      EXTRACT(YEAR  FROM CURRENT_DATE)   AS y
    FROM players p
    WHERE p.league = $1
      AND p.dob IS NOT NULL
      AND p.dob ~ '^\\d'
      AND EXISTS (
        SELECT 1 FROM stats s
        JOIN games g ON g.id = s.gameid
        WHERE s.playerid = p.id AND g.season = $2
      )
  ),
  with_date AS (
    SELECT
      id, name, image_url, dob, dob_date,
      MAKE_DATE(
        y::int,
        m::int,
        CASE
          WHEN m::int = 2 AND d::int = 29 AND NOT (
            (y::int % 4 = 0 AND y::int % 100 <> 0) OR (y::int % 400 = 0)
          ) THEN 28
          ELSE d::int
        END
      ) AS bday_date,
      EXTRACT(YEAR FROM AGE(
        MAKE_DATE(
          y::int,
          m::int,
          CASE
            WHEN m::int = 2 AND d::int = 29 AND NOT (
              (y::int % 4 = 0 AND y::int % 100 <> 0) OR (y::int % 400 = 0)
            ) THEN 28
            ELSE d::int
          END
        ),
        dob_date
      ))::int AS age
    FROM parsed
  )
  SELECT
    id           AS player_id,
    name         AS player_name,
    image_url    AS player_image,
    dob,
    bday_date,
    age
  FROM with_date
  WHERE bday_date <= CURRENT_DATE
    AND bday_date > CURRENT_DATE - INTERVAL '30 days'
  ORDER BY bday_date DESC
  LIMIT 200
`;

export async function getBirthdaysForLeague(league) {
  try {
    const currentSeason = await getCurrentSeason(league);
    if (!currentSeason) return [];
    const result = await pool.query(QUERY, [league, currentSeason]);
    return result.rows.map((r) => {
      const iso = new Date(r.bday_date).toISOString();
      return {
        id: `birthday-${r.player_id}-${iso.slice(0, 10)}`,
        type: "birthday",
        date: iso,
        league,
        player: {
          id: r.player_id,
          name: r.player_name,
          slug: slugForName(r.player_name),
          imageUrl: r.player_image,
          league,
        },
        age: r.age,
      };
    });
  } catch (err) {
    log.warn({ err: err?.message, league }, "birthdays query failed");
    return [];
  }
}
