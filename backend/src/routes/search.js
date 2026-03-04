import express from "express";
import { DateTime } from "luxon";
import db from "../db/db.js";

const router = express.Router();
const CURRENT_SEASON = "2025-26";

function getSeasonYears(season) {
  const [startYearText, endYearSuffix] = season.split("-");
  const startYear = Number(startYearText);

  if (!Number.isInteger(startYear) || !endYearSuffix) {
    return null;
  }

  const century = startYearText.slice(0, startYearText.length - endYearSuffix.length);
  const endYear = Number(`${century}${endYearSuffix}`);

  if (!Number.isInteger(endYear)) {
    return null;
  }

  return { startYear, endYear };
}

function getSeasonYearForMonth(month, season = CURRENT_SEASON) {
  const years = getSeasonYears(season);

  if (!years) {
    return DateTime.now().setZone("utc").year;
  }

  return month >= 7 ? years.startYear : years.endYear;
}

// Returns a YYYY-MM-DD string if term looks like a date, otherwise null.
// Excludes bare 4-digit years ("2026") and terms shorter than 4 chars.
function tryParseDate(term) {
  if (term.length < 4 || /^\d{4}$/.test(term)) return null;

  const fullDateFormats = [
    "yyyy-M-d",
    "M/d/yyyy",
    "M-d-yyyy",
    "MMM d yyyy",
    "MMM d, yyyy",
    "MMMM d yyyy",
    "MMMM d, yyyy",
  ];

  for (const format of fullDateFormats) {
    const parsed = DateTime.fromFormat(term, format, {
      locale: "en-US",
      zone: "utc",
    });

    if (parsed.isValid) {
      return parsed.toISODate();
    }
  }

  const partialDateFormats = [
    {
      probeFormat: "M/d/yyyy",
      buildTermWithYear: (year) => `${term}/${year}`,
    },
    {
      probeFormat: "M-d-yyyy",
      buildTermWithYear: (year) => `${term}-${year}`,
    },
    {
      probeFormat: "MMM d yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMM d, yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMMM d yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
    {
      probeFormat: "MMMM d, yyyy",
      buildTermWithYear: (year) => `${term} ${year}`,
    },
  ];

  for (const { probeFormat, buildTermWithYear } of partialDateFormats) {
    const partial = DateTime.fromFormat(buildTermWithYear(2000), probeFormat, {
      locale: "en-US",
      zone: "utc",
    });

    if (!partial.isValid) {
      continue;
    }

    const seasonYear = getSeasonYearForMonth(partial.month);
    const parsed = DateTime.fromFormat(
      buildTermWithYear(seasonYear),
      probeFormat,
      {
      locale: "en-US",
      zone: "utc",
      }
    );

    if (parsed.isValid) {
      return parsed.toISODate();
    }
  }

  return null;
}

// $1 = '%term%' (ILIKE pattern), $2 = 'term' (raw, for scoring), $3 = date or null
const SEARCH_QUERY = `
WITH raw_results AS (
  (
    SELECT id, name, league, image_url AS "imageUrl", NULL AS shortname, NULL::date AS date, 'player' AS type
    FROM players
    WHERE name ILIKE $1
  )
  UNION ALL
  (
    SELECT id, name, league, logo_url AS "imageUrl", shortname, NULL::date AS date, 'team' AS type
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
           'game' AS type
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
SELECT id, name, league, "imageUrl", shortname, date, type
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

router.get("/search", async (req, res) => {
  const { term } = req.query;
  if (!term || term.trim().length === 0) {
    return res.json([]);
  }

  const sanitizedTerm = term.trim();

  try {
    const result = await db.query(SEARCH_QUERY, [
      `%${sanitizedTerm}%`,
      sanitizedTerm,
      tryParseDate(sanitizedTerm),
    ]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
