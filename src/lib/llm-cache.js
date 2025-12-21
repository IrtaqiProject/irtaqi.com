import { createHash } from "crypto";

import { getDbPool } from "./db";

const CACHE_TTL_SECONDS = 60 * 60;

const globalStore = globalThis;
let memoryCache = globalStore._llmCache ?? new Map();
let dbDisabled = globalStore._llmCacheDbDisabled ?? false;

function buildCacheKey(systemPrompt, userContent) {
  return createHash("sha256").update(systemPrompt + userContent).digest("hex");
}

function readFromMemory(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.completion;
}

function writeToMemory(key, completion) {
  memoryCache.set(key, {
    completion,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
  globalStore._llmCache = memoryCache;
}

async function readFromDb(key) {
  if (dbDisabled) return null;

  const db = getDbPool();
  if (!db) {
    dbDisabled = true;
    globalStore._llmCacheDbDisabled = true;
    return null;
  }

  try {
    const { rows } = await db.query(
      `
        SELECT completion
        FROM llm_cache
        WHERE cache_key = $1
          AND created_at > NOW() - INTERVAL '1 hour'
      `,
      [key],
    );

    const completion = rows?.[0]?.completion ?? null;
    if (completion) {
      writeToMemory(key, completion);
    }
    return completion;
  } catch (err) {
    dbDisabled = true;
    globalStore._llmCacheDbDisabled = true;
    console.warn("[llm-cache] Postgres get gagal, fallback ke memory.", err.message);
    return null;
  }
}

async function writeToDb(key, completion) {
  if (dbDisabled) return;

  const db = getDbPool();
  if (!db) {
    dbDisabled = true;
    globalStore._llmCacheDbDisabled = true;
    return;
  }

  try {
    await db.query(
      `
        INSERT INTO llm_cache (cache_key, completion, created_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (cache_key)
        DO UPDATE SET completion = EXCLUDED.completion, created_at = NOW()
      `,
      [key, completion],
    );
  } catch (err) {
    dbDisabled = true;
    globalStore._llmCacheDbDisabled = true;
    console.warn("[llm-cache] Postgres set gagal, fallback ke memory.", err.message);
  }
}

export function computeCacheKey({ systemPrompt, userContent }) {
  return buildCacheKey(systemPrompt, userContent);
}

export async function getCachedCompletion({ systemPrompt, userContent }) {
  const key = buildCacheKey(systemPrompt, userContent);
  const fromMemory = readFromMemory(key);
  if (fromMemory) {
    return { key, completion: fromMemory };
  }

  const fromDb = await readFromDb(key);
  return { key, completion: fromDb ?? null };
}

export async function setCachedCompletion(key, completion) {
  if (!key || !completion) return;
  writeToMemory(key, completion);
  await writeToDb(key, completion);
}
