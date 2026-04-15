import logger from "../../logger.js";

const log = logger.child({ worker: "cleanupClinchedPlayoffGames" });

/**
 * Delete unplayed NBA playoff games whose series has already clinched.
 *
 * ESPN schedules "if necessary" games (e.g. Games 5-7 of a best-of-7 series)
 * ahead of time. When a series ends early, those rows remain as
 * `status = 'Scheduled'` with no winnerid/scores. ESPN drops them from their
 * feed once the series clinches, so they are never re-upserted — we simply
 * remove our local copies here.
 *
 * A series is considered clinched when one team in the (home, away) pair has
 * >= 4 wins across games of type 'playoff' or 'final' in the same season.
 *
 * No cascades: unplayed games have no stats or plays attached.
 */
export async function cleanupClinchedPlayoffGames(pool) {
  const { rows } = await pool.query(`
    WITH pair_wins AS (
      SELECT
        league,
        season,
        LEAST(hometeamid, awayteamid)    AS team_a,
        GREATEST(hometeamid, awayteamid) AS team_b,
        COUNT(*) FILTER (WHERE winnerid = LEAST(hometeamid, awayteamid))    AS wins_a,
        COUNT(*) FILTER (WHERE winnerid = GREATEST(hometeamid, awayteamid)) AS wins_b
      FROM games
      WHERE league = 'nba'
        AND type IN ('playoff', 'final')
        AND winnerid IS NOT NULL
        AND hometeamid IS NOT NULL
        AND awayteamid IS NOT NULL
      GROUP BY league, season, team_a, team_b
    ),
    clinched AS (
      SELECT league, season, team_a, team_b
      FROM pair_wins
      WHERE wins_a >= 4 OR wins_b >= 4
    )
    DELETE FROM games g
    USING clinched c
    WHERE g.league = c.league
      AND g.season = c.season
      AND LEAST(g.hometeamid, g.awayteamid)    = c.team_a
      AND GREATEST(g.hometeamid, g.awayteamid) = c.team_b
      AND g.type IN ('playoff', 'final')
      AND g.status = 'Scheduled'
      AND g.winnerid IS NULL
      AND g.homescore IS NULL
      AND g.awayscore IS NULL
    RETURNING g.id, g.league, g.season
  `);

  log.info(
    { deleted: rows.length, league: "nba" },
    "cleaned up clinched-series playoff games",
  );

  return rows;
}
