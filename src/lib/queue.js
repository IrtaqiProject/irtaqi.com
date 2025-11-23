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

const globalForQueue = globalThis;

export const redisConnection =
  globalForQueue._redisConnection ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

if (!globalForQueue._redisConnection) {
  globalForQueue._redisConnection = redisConnection;
}

export const transcriptionQueue =
  globalForQueue._transcriptionQueue ??
  new Queue(queueName, {
    connection: redisConnection,
    defaultJobOptions,
  });

if (!globalForQueue._transcriptionQueue) {
  globalForQueue._transcriptionQueue = transcriptionQueue;
}

export async function enqueueTranscriptionJob(payload) {
  return transcriptionQueue.add("transcription", payload);
}
