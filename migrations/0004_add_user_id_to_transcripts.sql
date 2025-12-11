-- Tambah kolom user_id agar setiap transcript terkait dengan pemilik akun
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Index untuk query per user
CREATE INDEX IF NOT EXISTS transcripts_user_id_idx ON transcripts (user_id);
