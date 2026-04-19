export const MINUTES_FILTER_SQL = `(($1 = 'nba' AND s.minutes > 0)
  OR ($1 = 'nhl' AND s.toi IS NOT NULL AND s.toi != '0:00')
  OR ($1 = 'nfl' AND NOT (s.yds IS NULL AND s.td IS NULL AND s.sacks IS NULL AND s.interceptions IS NULL AND s.cmpatt IS NULL)))`;

export const MINUTES_FILTER_BY_LEAGUE = {
  nba: `s.minutes > 0`,
  nhl: `s.toi IS NOT NULL AND s.toi != '0:00'`,
  nfl: `NOT (s.yds IS NULL AND s.td IS NULL AND s.sacks IS NULL AND s.interceptions IS NULL AND s.cmpatt IS NULL)`,
};
