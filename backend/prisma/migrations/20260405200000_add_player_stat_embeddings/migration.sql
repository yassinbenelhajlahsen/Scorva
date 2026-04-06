CREATE TABLE player_stat_embeddings (
  id         SERIAL PRIMARY KEY,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league     TEXT NOT NULL,
  season     TEXT NOT NULL,
  embedding  vector(14) NOT NULL,
  games_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, league, season)
);

CREATE INDEX player_stat_embeddings_vec_idx
  ON player_stat_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_player_stat_embeddings_league_season
  ON player_stat_embeddings(league, season);
