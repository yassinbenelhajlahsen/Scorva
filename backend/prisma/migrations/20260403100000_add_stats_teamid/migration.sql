-- Add teamid to stats to record which team a player was on at the time of each game.
-- Nullable so existing rows can be backfilled separately.
ALTER TABLE stats ADD COLUMN teamid INT REFERENCES teams(id) ON DELETE SET NULL;

-- Supports WHERE s.teamid = g.hometeamid / g.awayteamid in gameDetailService queries.
CREATE INDEX idx_stats_teamid ON stats(teamid);
