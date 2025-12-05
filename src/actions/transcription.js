"use server";

import { z } from "zod";

import { saveTranscriptResult } from "@/lib/db";
import {
  generateMindmapFromTranscript,
  generateQaFromTranscript,
  generateQuizFromTranscript,
  generateSummaryFromTranscript,
  transcribeAudioStub,
} from "@/lib/openai";
import { extractVideoId, fetchYoutubeTranscript } from "@/lib/youtube";

const processSchema = z.object({
  youtubeUrl: z.string().url(),
});

function estimateDurationSeconds(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const seconds = segments.reduce((max, seg) => {
    const start = Number(seg?.start ?? 0);
    const duration = Number(seg?.duration ?? 0);
    return Math.max(max, start + duration);
  }, 0);
  return Math.round(seconds);
}

function decideQuizCount(durationSeconds) {
  if (!durationSeconds || Number.isNaN(durationSeconds)) return 10;
  const minutes = durationSeconds / 60;
  if (minutes < 15) return 10;
  if (minutes < 30) return 15;
  if (minutes < 60) return 25;
  if (minutes > 120) return 30;
  return 25; // default untuk 60–120 menit
}

export async function processYoutubeTranscriptionAction(input) {
  const parsed = processSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const videoId = extractVideoId(parsed.data.youtubeUrl);
  if (!videoId) {
    throw new Error("URL YouTube tidak valid");
  }

  const transcript = await fetchYoutubeTranscript(videoId);
  const durationSeconds = estimateDurationSeconds(transcript.segments);

  const saved = await saveTranscriptResult({
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    prompt: "",
    transcriptText: transcript.text,
    srt: transcript.srt,
    summary: null,
    qa: null,
    mindmap: null,
    quiz: null,
    durationSeconds,
    model: null,
  });

  return {
    id: saved?.id ?? null,
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    transcript: transcript.text,
    srt: transcript.srt,
    model: null,
    createdAt: saved?.created_at ?? null,
    lang: transcript.lang,
    durationSeconds,
  };
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
  return transcribeAudioStub(audioUrl, prompt);
}

const featureBaseSchema = z.object({
  transcript: z.string().min(10, "Transcript kosong atau terlalu singkat."),
  prompt: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  videoId: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
});

const quizSchema = featureBaseSchema.extend({
  quizCount: z.number().int().positive().max(60).optional(),
});

function resolveVideoTitle(videoId, youtubeUrl) {
  if (youtubeUrl) return youtubeUrl;
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  return "Transkrip YouTube";
}

export async function generateSummaryAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk ringkasan");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds } = parsed.data;
  const { summary, model } = await generateSummaryFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  return { summary, model };
}

export async function generateQaAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk Q&A");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds } = parsed.data;
  const { qa, model } = await generateQaFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  return { qa, model };
}

export async function generateMindmapAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk mindmap");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds } = parsed.data;
  const { mindmap, model } = await generateMindmapFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  return { mindmap, model };
}

export async function generateQuizAction(input) {
  const parsed = quizSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk quiz");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds, quizCount } = parsed.data;
  const resolvedQuizCount = quizCount ?? decideQuizCount(durationSeconds ?? null);

  const { quiz, model } = await generateQuizFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    quizCount: resolvedQuizCount,
    durationSeconds: durationSeconds ?? null,
  });

  return { quiz, model, durationSeconds: durationSeconds ?? null };
}
