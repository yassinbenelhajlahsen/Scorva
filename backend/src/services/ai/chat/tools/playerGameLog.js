import pool from "../../../../db/db.js";
import { MINUTES_FILTER_BY_LEAGUE } from "../../../../utils/statFilters.js";

const STAT_COLUMNS = {
  nba: {
    points: "points",
    assists: "assists",
    rebounds: "rebounds",
    steals: "steals",
    blocks: "blocks",
    turnovers: "turnovers",
    minutes: "minutes",
  },
  nfl: { yds: "yds", td: "td", interceptions: "interceptions" },
  nhl: { g: "g", a: "a", shots: "shots", saves: "saves", pim: "pim" },
};

const SELECT_BY_LEAGUE = {
  nba: `s.points, s.assists, s.rebounds, s.steals, s.blocks, s.turnovers, s.minutes, s.fg, s.threept, s.ft, s.plusminus`,
  nfl: `s.yds, s.td, s.interceptions, s.sacks, s.cmpatt`,
  nhl: `s.g, s.a, s.shots, s.saves, s.savepct, s.ga, s.toi, s.pim, s.sm, s.bs`,
};

export async function getPlayerGameLog({
  league,
  playerId,
  seasonStart,
  seasonEnd,
  season,
  minStat,
  minValue,
  limit = 30,
}) {
  if (!league || !playerId) return { error: "league and playerId required" };
  const select = SELECT_BY_LEAGUE[league];
  if (!select) return { error: `Invalid league: ${league}` };

  const minutesFilter = MINUTES_FILTER_BY_LEAGUE[league];
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 30), 82);

  const params = [league, playerId];
  const where = [
    "g.league = $1",
    "s.playerid = $2",
    "g.status ILIKE 'Final%'",
    "g.type IN ('regular', 'makeup', 'playoff')",
    minutesFilter,
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

  if (minStat && minValue != null) {
    const safeColumn = STAT_COLUMNS[league]?.[minStat];
    if (!safeColumn) {
      return { error: `Invalid minStat '${minStat}' for league '${league}'` };
    }
    params.push(minValue);
    where.push(`s.${safeColumn} >= $${params.length}`);
  }

  params.push(safeLimit);

  const result = await pool.query(
    `SELECT g.id AS game_id, g.date, g.season,
            ht.shortname AS home, at.shortname AS away,
            g.homescore, g.awayscore,
            CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN at.shortname ELSE ht.shortname END AS opponent,
            CASE WHEN COALESCE(s.teamid, p.teamid) = g.winnerid THEN 'W' ELSE 'L' END AS result,
            ${select}
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     JOIN teams ht ON ht.id = g.hometeamid
     JOIN teams at ON at.id = g.awayteamid
     WHERE ${where.join(" AND ")}
     ORDER BY g.date DESC
     LIMIT $${params.length}`,
    params,
  );

  return {
    league,
    playerId,
    season: season || null,
    seasonStart: seasonStart || null,
    seasonEnd: seasonEnd || null,
    games: result.rows,
    capped: result.rows.length === safeLimit,
  };
}
