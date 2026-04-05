-- Add popularity score column to players
ALTER TABLE players ADD COLUMN popularity INT DEFAULT 0;
CREATE INDEX idx_players_popularity ON players(popularity DESC);

-- Create player_aliases table for nickname/alias search support
CREATE TABLE player_aliases (
  id        SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  UNIQUE(player_id, alias)
);
CREATE INDEX idx_player_aliases_trgm ON player_aliases USING GIN (alias gin_trgm_ops);

-- Backfill popularity from existing stats
UPDATE players p
SET popularity = sub.game_count
FROM (
  SELECT playerid, COUNT(*) AS game_count
  FROM stats
  GROUP BY playerid
) sub
WHERE p.id = sub.playerid;
