import { Pool } from "pg";
import { nanoid } from "nanoid";

const globalStore = globalThis;

let pool = globalStore._pgPool;
let schemaEnsured = globalStore._pgSchemaEnsured ?? false;

function getConnectionString() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
}

function createPool() {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("Set POSTGRES_URL atau DATABASE_URL untuk koneksi Postgres.");
  }

  pool = new Pool({
    connectionString,
    max: 4,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  globalStore._pgPool = pool;
  return pool;
}

export function getDbPool() {
  return createPool();
}

async function ensureSchema() {
  if (schemaEnsured) return;

  const db = createPool();
  await db.query(`
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
  `);

  schemaEnsured = true;
  globalStore._pgSchemaEnsured = true;
}

function toJsonb(value) {
  return value ? JSON.stringify(value) : null;
}

export async function saveTranscriptResult({
  videoId,
  youtubeUrl,
  prompt,
  transcriptText,
  srt,
  summary,
  qa,
  mindmap,
  model,
}) {
  await ensureSchema();
  const db = createPool();
  const id = nanoid();

  const { rows } = await db.query(
    `
    INSERT INTO transcripts (
      id,
      video_id,
      youtube_url,
      prompt,
      transcript,
      srt,
      summary,
      qa,
      mindmap,
      model
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
    RETURNING *
  `,
    [
      id,
      videoId ?? null,
      youtubeUrl ?? null,
      prompt ?? "",
      transcriptText ?? "",
      srt ?? "",
      toJsonb(summary),
      toJsonb(qa),
      toJsonb(mindmap),
      model ?? null,
    ],
  );

  return rows[0];
}
