import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

const queueName = "transcription";
const defaultJobOptions: JobsOptions = {
  removeOnComplete: true,
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1500,
  },
};

declare global {
  // eslint-disable-next-line no-var
  var _transcriptionQueue: Queue | undefined;
  // eslint-disable-next-line no-var
  var _redisConnection: IORedis.Redis | undefined;
}

export const redisConnection =
  global._redisConnection ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

if (!global._redisConnection) {
  global._redisConnection = redisConnection;
}

export const transcriptionQueue =
  global._transcriptionQueue ??
  new Queue(queueName, {
    connection: redisConnection,
    defaultJobOptions,
  });

if (!global._transcriptionQueue) {
  global._transcriptionQueue = transcriptionQueue;
}

export type TranscriptionPayload = {
  videoId?: string;
  audioUrl?: string;
  prompt?: string;
};

export async function enqueueTranscriptionJob(payload: TranscriptionPayload) {
  return transcriptionQueue.add("transcription", payload);
}
