"use server";

import { z } from "zod";

import { enqueueTranscriptionJob } from "@/lib/queue";
import {
  getTranscription,
  listTranscriptions,
  markTranscriptionCompleted,
  markTranscriptionFailed,
  markTranscriptionQueued,
} from "@/lib/transcript-store";
import { extractVideoId } from "@/lib/youtube";
import { transcribeAudioStub, transcribeWithWhisperAPI } from "@/lib/openai";

const enqueueSchema = z.object({
  videoId: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
  prompt: z.string().optional(),
});

export async function enqueueTranscriptionAction(input) {
  const parsed = enqueueSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const { audioUrl, youtubeUrl, prompt } = parsed.data;
  const videoId = parsed.data.videoId ?? (youtubeUrl ? extractVideoId(youtubeUrl) : null);

  if (!videoId && !audioUrl) {
    throw new Error("Wajib isi videoId/youtubeUrl atau audioUrl");
  }

  const job = await enqueueTranscriptionJob({
    videoId: videoId ?? undefined,
    audioUrl,
    prompt,
  });
  markTranscriptionQueued(job.id, { videoId, audioUrl, prompt });
  const state = await job.getState();

  return { jobId: job.id, state };
}

const transcribeSchema = z.object({
  audioUrl: z.string().url(),
  prompt: z.string().optional(),
});

export async function transcribeDirectAction(input) {
  const parsed = transcribeSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const { audioUrl, prompt } = parsed.data;
  if (process.env.WHISPER_API_KEY) {
    return transcribeWithWhisperAPI(audioUrl, { prompt, language: "id" });
  }
  return transcribeAudioStub(audioUrl, prompt);
}

const jobIdSchema = z.object({
  jobId: z.string(),
});

export async function getTranscriptAction(input) {
  const parsed = jobIdSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("JobId tidak valid");
  }
  const found = getTranscription(parsed.data.jobId);
  return found ?? { jobId: parsed.data.jobId, status: "unknown" };
}

export async function listTranscriptsAction() {
  return listTranscriptions();
}

export async function markTranscriptCompletedAction(jobId, transcript) {
  markTranscriptionCompleted(jobId, transcript);
  return getTranscription(jobId);
}

export async function markTranscriptFailedAction(jobId, error) {
  markTranscriptionFailed(jobId, error);
  return getTranscription(jobId);
}
