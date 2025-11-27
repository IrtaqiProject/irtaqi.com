-- Transcript storage for YouTube processing pipeline
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  youtube_url TEXT,
  prompt TEXT,
  transcript TEXT,
  srt TEXT,
  summary JSONB,
  qa JSONB,
  mindmap JSONB,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
