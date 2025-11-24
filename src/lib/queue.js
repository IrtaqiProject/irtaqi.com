import { Queue } from "bullmq";
import IORedis from "ioredis";

const queueName = "transcription";
const defaultJobOptions = {
  removeOnComplete: true,
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1500,
  },
};

const disableRedis =
  process.env.DISABLE_REDIS === "true" || process.env.NEXT_PHASE === "phase-production-build";

const globalForQueue = globalThis;

let redisConnection = globalForQueue._redisConnection;
let transcriptionQueue = globalForQueue._transcriptionQueue;

function ensureRedisConnection() {
  if (disableRedis) return null;
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
    globalForQueue._redisConnection = redisConnection;
  }
  return redisConnection;
}

function ensureQueue() {
  const connection = ensureRedisConnection();
  if (!connection) return null;
  if (!transcriptionQueue) {
    transcriptionQueue = new Queue(queueName, {
      connection,
      defaultJobOptions,
    });
    globalForQueue._transcriptionQueue = transcriptionQueue;
  }
  return transcriptionQueue;
}

export async function enqueueTranscriptionJob(payload) {
  const queue = ensureQueue();
  if (!queue) {
    throw new Error("Queue disabled during build or missing Redis connection.");
  }
  return queue.add("transcription", payload);
}

export function getRedisConnection() {
  return ensureRedisConnection();
}

export function getTranscriptionQueue() {
  return ensureQueue();
}
