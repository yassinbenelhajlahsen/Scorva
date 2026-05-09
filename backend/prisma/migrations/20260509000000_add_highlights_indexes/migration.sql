-- Speeds ORDER BY rating DESC for top-performances queries.
CREATE INDEX IF NOT EXISTS stats_rating_desc_idx
  ON stats (rating DESC) WHERE rating IS NOT NULL;

-- Speeds ORDER BY weighted_value for play_ratings leaderboard.
CREATE INDEX IF NOT EXISTS play_ratings_weighted_desc_idx
  ON play_ratings (weighted_value DESC);
