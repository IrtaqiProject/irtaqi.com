-- Cache table untuk menyimpan hasil LLM berdasarkan hash prompt
CREATE TABLE IF NOT EXISTS llm_cache (
  cache_key TEXT PRIMARY KEY,
  completion JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_created_at ON llm_cache (created_at);
