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

function mergeIntoMemory(id, updates) {
  const index = memoryStore.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const definedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(definedUpdates).length === 0) return memoryStore[index];

  const merged = {
    ...memoryStore[index],
    ...definedUpdates,
  };

  memoryStore[index] = merged;
  globalStore._memoryTranscriptStore = memoryStore;

  return merged;
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
  quiz,
  durationSeconds,
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
      quiz,
      duration_seconds: durationSeconds ?? null,
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
      quiz,
      duration_seconds: durationSeconds ?? null,
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
        quiz,
        duration_seconds,
        model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12)
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
        toJsonb(quiz),
        durationSeconds ?? null,
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
      quiz,
      duration_seconds: durationSeconds ?? null,
      model,
    });
  }
}

export async function updateTranscriptFeatures({
  id,
  summary,
  qa,
  mindmap,
  quiz,
  model,
}) {
  if (!id) return null;

  const updates = { summary, qa, mindmap, quiz, model };
  const definedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!definedEntries.length) return null;

  if (dbDisabled) {
    return mergeIntoMemory(id, updates);
  }

  const db = createPool();
  if (!db) {
    return mergeIntoMemory(id, updates);
  }

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (summary !== undefined) {
    setClauses.push(`summary = $${idx}::jsonb`);
    values.push(toJsonb(summary));
    idx += 1;
  }
  if (qa !== undefined) {
    setClauses.push(`qa = $${idx}::jsonb`);
    values.push(toJsonb(qa));
    idx += 1;
  }
  if (mindmap !== undefined) {
    setClauses.push(`mindmap = $${idx}::jsonb`);
    values.push(toJsonb(mindmap));
    idx += 1;
  }
  if (quiz !== undefined) {
    setClauses.push(`quiz = $${idx}::jsonb`);
    values.push(toJsonb(quiz));
    idx += 1;
  }
  if (model !== undefined) {
    setClauses.push(`model = $${idx}`);
    values.push(model ?? null);
    idx += 1;
  }

  values.push(id);

  try {
    const { rows } = await db.query(
      `UPDATE transcripts SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows?.[0] ?? null;
  } catch (err) {
    dbDisabled = true;
    globalStore._pgDisabled = true;
    console.warn("[db] Update transcript gagal, fallback ke memory store.", err.message);
    return mergeIntoMemory(id, updates);
  }
}
