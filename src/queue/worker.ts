import { Worker } from "bullmq";

import { redisConnection } from "@/lib/queue";
import { transcribeAudioStub } from "@/lib/openai";

const queueName = "transcription";

export const worker = new Worker(
  queueName,
  async (job) => {
    const { audioUrl, videoId, prompt } = job.data as {
      audioUrl?: string;
      videoId?: string;
      prompt?: string;
    };

    // TODO: fetch the YouTube audio by videoId and upload buffer to Whisper.
    return transcribeAudioStub(audioUrl ?? videoId ?? "unknown-source", prompt);
  },
  {
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.info(`[worker] job completed`, { id: job.id });
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job failed`, { id: job?.id, err });
});
