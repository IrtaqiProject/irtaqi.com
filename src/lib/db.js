import { Pool } from "pg";
import { nanoid } from "nanoid";

const globalStore = globalThis;

let pool = globalStore._pgPool;
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

    const migrationHint =
      err?.code === "42P01"
        ? "Table transcripts belum ada. Jalankan migration dengan `bun run migrate` sebelum menjalankan app."
        : "Postgres insert gagal, fallback ke memory store. Periksa koneksi.";

    console.warn(`[db] ${migrationHint}`, err.message);
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
