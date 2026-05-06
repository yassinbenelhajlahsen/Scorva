import pool from "../../../../db/db.js";

const SORT_OPTIONS = {
  total_desc: "(g.homescore + g.awayscore) DESC",
  total_asc: "(g.homescore + g.awayscore) ASC",
  margin_desc: "ABS(g.homescore - g.awayscore) DESC",
  margin_asc: "ABS(g.homescore - g.awayscore) ASC",
  date_desc: "g.date DESC",
  date_asc: "g.date ASC",
};

export async function findGames({
  league,
  seasonStart,
  seasonEnd,
  season,
  teamId,
  minTotal,
  maxMargin,
  minMargin,
  overtime,
  dateStart,
  dateEnd,
  sort = "total_desc",
  limit = 15,
}) {
  if (!league) return { error: "league required" };

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 15), 30);
  const safeSort = SORT_OPTIONS[sort] || SORT_OPTIONS.total_desc;

  const params = [league];
  const where = [
    "g.league = $1",
    "g.status ILIKE 'Final%'",
    "g.type IN ('regular', 'makeup', 'playoff')",
  ];

  if (season) {
    params.push(season);
    where.push(`g.season = $${params.length}`);
  } else {
    if (seasonStart) {
      params.push(seasonStart);
      where.push(`g.season >= $${params.length}`);
    }
    if (seasonEnd) {
      params.push(seasonEnd);
      where.push(`g.season <= $${params.length}`);
    }
  }

  if (teamId) {
    params.push(teamId);
    where.push(`(g.hometeamid = $${params.length} OR g.awayteamid = $${params.length})`);
  }
  if (minTotal != null) {
    params.push(minTotal);
    where.push(`(g.homescore + g.awayscore) >= $${params.length}`);
  }
  if (maxMargin != null) {
    params.push(maxMargin);
    where.push(`ABS(g.homescore - g.awayscore) <= $${params.length}`);
  }
  if (minMargin != null) {
    params.push(minMargin);
    where.push(`ABS(g.homescore - g.awayscore) >= $${params.length}`);
  }
  if (overtime === true) {
    where.push(`(g.status ILIKE '%/OT%' OR g.status ILIKE '%/SO')`);
  } else if (overtime === false) {
    where.push(`g.status NOT ILIKE '%/OT%' AND g.status NOT ILIKE '%/SO'`);
  }
  if (dateStart) {
    params.push(dateStart);
    where.push(`g.date >= $${params.length}`);
  }
  if (dateEnd) {
    params.push(dateEnd);
    where.push(`g.date <= $${params.length}`);
  }

  params.push(safeLimit);

  const result = await pool.query(
    `SELECT g.id AS game_id, g.date, g.season, g.status, g.type AS game_type,
            ht.id AS home_team_id, ht.shortname AS home,
            at.id AS away_team_id, at.shortname AS away,
            g.homescore, g.awayscore,
            (g.homescore + g.awayscore) AS total,
            ABS(g.homescore - g.awayscore) AS margin,
            CASE WHEN g.winnerid = g.hometeamid THEN ht.shortname
                 WHEN g.winnerid = g.awayteamid THEN at.shortname
                 ELSE NULL END AS winner
     FROM games g
     JOIN teams ht ON ht.id = g.hometeamid
     JOIN teams at ON at.id = g.awayteamid
     WHERE ${where.join(" AND ")}
     ORDER BY ${safeSort}
     LIMIT $${params.length}`,
    params,
  );

  return { league, sort, games: result.rows };
}
