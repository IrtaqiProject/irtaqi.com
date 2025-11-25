const globalStore = globalThis;

if (!globalStore._transcriptStore) {
  globalStore._transcriptStore = {
    items: new Map(),
  };
}

const store = globalStore._transcriptStore;

export function markTranscriptionQueued(jobId, payload = {}) {
  store.items.set(jobId, {
    jobId,
    status: "queued",
    payload,
    transcript: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function markTranscriptionCompleted(jobId, transcript) {
  const existing = store.items.get(jobId) ?? {};
  store.items.set(jobId, {
    ...existing,
    jobId,
    status: "completed",
    transcript,
    error: null,
    updatedAt: new Date().toISOString(),
  });
}

export function markTranscriptionFailed(jobId, error) {
  const existing = store.items.get(jobId) ?? {};
  store.items.set(jobId, {
    ...existing,
    jobId,
    status: "failed",
    transcript: null,
    error: typeof error === "string" ? error : error?.message ?? "Unknown error",
    updatedAt: new Date().toISOString(),
  });
}

export function getTranscription(jobId) {
  return store.items.get(jobId) ?? null;
}

export function listTranscriptions() {
  return Array.from(store.items.values()).sort((a, b) => {
    return (b.updatedAt ?? b.createdAt ?? 0).localeCompare(a.updatedAt ?? a.createdAt ?? 0);
  });
}
