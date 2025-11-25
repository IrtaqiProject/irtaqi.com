import { Worker } from "bullmq";

import { getRedisConnection } from "@/lib/queue";
import { transcribeAudioStub, transcribeWithWhisperAPI } from "@/lib/openai";
import { markTranscriptionCompleted, markTranscriptionFailed } from "@/lib/transcript-store";

const queueName = "transcription";

export const worker = new Worker(
  queueName,
  async (job) => {
    const { audioUrl, videoId, prompt } = job.data || {};

    // TODO: fetch the YouTube audio by videoId and upload buffer to Whisper.
    const source = audioUrl ?? videoId ?? "unknown-source";
    try {
      const result =
        process.env.WHISPER_API_KEY && audioUrl
          ? await transcribeWithWhisperAPI(audioUrl, { prompt, language: "id" })
          : await transcribeAudioStub(source, prompt);
      markTranscriptionCompleted(job.id, result);
      return result;
    } catch (error) {
      markTranscriptionFailed(job.id, error);
      throw error;
    }
  },
  { connection: getRedisConnection() ?? undefined },
);

worker.on("completed", (job) => {
  console.info(`[worker] job completed`, { id: job.id });
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job failed`, { id: job?.id, err });
});
