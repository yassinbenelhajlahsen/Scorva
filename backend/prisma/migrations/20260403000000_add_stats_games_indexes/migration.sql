-- Index on stats.playerid to support efficient per-player lookups in
-- playerInfoService and favoritesService. The composite PK (gameid, playerid)
-- cannot be used for playerid-only predicates.
CREATE INDEX idx_stats_playerid ON stats(playerid);

-- Composite index on games(league, season, date) to support:
--   - date navigation queries (gamesService getGames with date param)
--   - getSeasonForDate lookup (league + date)
--   - getGameDates GROUP BY (league + season prefix)
--   - standings join filter (league + season prefix)
--   - team/season game list (league + season prefix)
CREATE INDEX idx_games_league_season_date ON games(league, season, date);
