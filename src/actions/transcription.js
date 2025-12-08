"use server";

import { z } from "zod";

import { saveTranscriptResult, updateTranscriptFeatures } from "@/lib/db";
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
    durationSeconds,
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
  transcriptId: z.string().optional(),
});

const quizSchema = featureBaseSchema.extend({
  quizCount: z.number().int().positive().max(60).optional(),
});

function resolveVideoTitle(videoId, youtubeUrl) {
  if (youtubeUrl) return youtubeUrl;
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  return "Transkrip YouTube";
}

function requireTranscriptId(transcriptId) {
  if (!transcriptId) {
    throw new Error("Transcript belum tersimpan. Ulangi langkah transcribe untuk mendapatkan ID.");
  }
  return transcriptId;
}

async function persistFeatures(transcriptId, updates) {
  const saved = await updateTranscriptFeatures({ id: transcriptId, ...updates });
  if (!saved) {
    throw new Error("Gagal menyimpan hasil. Coba ulangi proses generate.");
  }
  return saved;
}

export async function generateSummaryAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk ringkasan");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds, transcriptId } =
    parsed.data;
  const ensuredTranscriptId = requireTranscriptId(transcriptId);
  const { summary, model } = await generateSummaryFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  await persistFeatures(ensuredTranscriptId, { summary, model });

  return { summary, model };
}

export async function generateQaAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk Q&A");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds, transcriptId } =
    parsed.data;
  const ensuredTranscriptId = requireTranscriptId(transcriptId);
  const { qa, model } = await generateQaFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  await persistFeatures(ensuredTranscriptId, { qa, model });

  return { qa, model };
}

export async function generateMindmapAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk mindmap");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds, transcriptId } =
    parsed.data;
  const ensuredTranscriptId = requireTranscriptId(transcriptId);
  const { mindmap, model } = await generateMindmapFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  });

  await persistFeatures(ensuredTranscriptId, { mindmap, model });

  return { mindmap, model };
}

export async function generateQuizAction(input) {
  const parsed = quizSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk quiz");

  const { transcript, prompt, videoId, youtubeUrl, durationSeconds, quizCount, transcriptId } =
    parsed.data;
  const ensuredTranscriptId = requireTranscriptId(transcriptId);
  const resolvedQuizCount = quizCount ?? decideQuizCount(durationSeconds ?? null);

  const { quiz, model } = await generateQuizFromTranscript(transcript, {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    quizCount: resolvedQuizCount,
    durationSeconds: durationSeconds ?? null,
  });

  await persistFeatures(ensuredTranscriptId, { quiz, model });

  return { quiz, model, durationSeconds: durationSeconds ?? null };
}

// Jalankan ringkasan, Q&A, dan mindmap secara paralel untuk hemat waktu.
export async function generateInsightsAction(input) {
  const parsed = featureBaseSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Input tidak valid untuk insights");

  const {
    transcript,
    prompt,
    videoId,
    youtubeUrl,
    durationSeconds,
    transcriptId,
  } = parsed.data;

  const ensuredTranscriptId = requireTranscriptId(transcriptId);
  const commonOptions = {
    prompt,
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    durationSeconds: durationSeconds ?? null,
  };

  const [summaryResult, qaResult, mindmapResult] = await Promise.all([
    generateSummaryFromTranscript(transcript, commonOptions),
    generateQaFromTranscript(transcript, commonOptions),
    generateMindmapFromTranscript(transcript, commonOptions),
  ]);

  const summary = summaryResult?.summary ?? null;
  const qa = qaResult?.qa ?? null;
  const mindmap = mindmapResult?.mindmap ?? null;
  const model =
    summaryResult?.model ?? qaResult?.model ?? mindmapResult?.model ?? null;

  await persistFeatures(ensuredTranscriptId, {
    summary,
    qa,
    mindmap,
    model,
  });

  return { summary, qa, mindmap, model };
}
