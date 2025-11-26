import { Pool } from "pg";
import { nanoid } from "nanoid";

const globalStore = globalThis;

let pool = globalStore._pgPool;
let schemaEnsured = globalStore._pgSchemaEnsured ?? false;
let dbDisabled = globalStore._pgDisabled ?? false;
let memoryStore = globalStore._memoryTranscriptStore ?? [];

function getConnectionString() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
}

function createPool() {
  if (dbDisabled) return null;
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    dbDisabled = true;
    globalStore._pgDisabled = true;
    return null;
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
  if (dbDisabled || schemaEnsured) return;

  const db = createPool();
  if (!db) return;

  try {
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
  } catch (err) {
    dbDisabled = true;
    globalStore._pgDisabled = true;
    console.warn(
      "[db] Menonaktifkan Postgres (gagal membuat schema). Periksa POSTGRES_URL/DATABASE_URL.",
      err.message,
    );
  }
}

function toJsonb(value) {
  return value ? JSON.stringify(value) : null;
}

function saveToMemory(payload) {
  const record = {
    ...payload,
    id: nanoid(),
    created_at: new Date().toISOString(),
  };
  memoryStore.push(record);
  globalStore._memoryTranscriptStore = memoryStore;
  return record;
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

  if (dbDisabled) {
    return saveToMemory({
      video_id: videoId ?? null,
      youtube_url: youtubeUrl ?? null,
      prompt: prompt ?? "",
      transcript: transcriptText ?? "",
      srt: srt ?? "",
      summary,
      qa,
      mindmap,
      model,
    });
  }

  const db = createPool();
  if (!db) {
    return saveToMemory({
      video_id: videoId ?? null,
      youtube_url: youtubeUrl ?? null,
      prompt: prompt ?? "",
      transcript: transcriptText ?? "",
      srt: srt ?? "",
      summary,
      qa,
      mindmap,
      model,
    });
  }

  const id = nanoid();

  try {
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
  } catch (err) {
    dbDisabled = true;
    globalStore._pgDisabled = true;
    console.warn("[db] Postgres insert gagal, fallback ke memory store. Periksa koneksi.", err.message);
    return saveToMemory({
      video_id: videoId ?? null,
      youtube_url: youtubeUrl ?? null,
      prompt: prompt ?? "",
      transcript: transcriptText ?? "",
      srt: srt ?? "",
      summary,
      qa,
      mindmap,
      model,
    });
  }
}
