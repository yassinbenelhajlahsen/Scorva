import pool from "../../db/db.js";
import logger from "../../logger.js";

const log = logger.child({ module: "birthdaysReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

// dob is stored as "DD/M/YYYY" (e.g. "14/9/1989"). We parse with TO_DATE using
// the 'DD/MM/YYYY' mask (works for both single- and double-digit months/days).
// The backward 30-day window excludes future dates and spans one rolling month.
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
    FROM players
    WHERE league = $1
      AND popularity > 0
      AND dob IS NOT NULL
      AND dob ~ '^\\d'
  ),
  with_date AS (
    SELECT
      id, name, image_url, dob, dob_date,
      MAKE_DATE(
        y::int,
        m::int,
        -- Map Feb 29 -> Feb 28 in non-leap years so MAKE_DATE doesn't throw.
        -- Players born on leap day get their birthday on Feb 28 in non-leap years.
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
    const result = await pool.query(QUERY, [league]);
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
