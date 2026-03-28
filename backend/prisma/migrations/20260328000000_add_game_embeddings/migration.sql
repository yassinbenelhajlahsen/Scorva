-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Store embeddings of AI game summaries for semantic search (RAG)
CREATE TABLE game_embeddings (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX game_embeddings_vec_idx ON game_embeddings
  USING hnsw (embedding vector_cosine_ops);
