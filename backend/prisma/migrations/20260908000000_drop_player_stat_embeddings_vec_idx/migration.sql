-- similarPlayersService never uses this HNSW index: it forces a sequential scan
-- (the index post-filters by season and returned too few rows), so the index
-- only cost maintenance on every embeddings rewrite plus 11 MB of cache.
DROP INDEX IF EXISTS player_stat_embeddings_vec_idx;
