-- Tambahan kolom untuk menyimpan hasil quiz serta durasi video (detik)
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS quiz JSONB,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
