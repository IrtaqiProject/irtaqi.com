"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";

import { saveTranscriptResult, updateTranscriptFeatures } from "@/lib/db";
import {
  generateMindmapFromTranscript,
  generateQaFromTranscript,
  generateQuizFromTranscript,
  generateSummaryFromTranscript,
  transcribeAudioStub,
  transcribeAudioWithWhisper,
} from "@/lib/openai";
import {
  downloadYoutubeAudio,
  extractVideoId,
  fetchYoutubeTranscript,
} from "@/lib/youtube";
import { authOptions } from "@/lib/auth";

const processSchema = z.object({
  youtubeUrl: z.string().url(),
});

function estimateDurationSeconds(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const seconds = segments.reduce((max, seg) => {
    const start = Number(seg?.start ?? 0);
    const duration = Number(seg?.duration ?? 0);
    const end = Number.isFinite(duration) && duration > 0 ? start + duration : Number(seg?.end ?? start);
    return Math.max(max, end);
  }, 0);
  const rounded = Math.round(seconds);
  return Number.isFinite(rounded) ? rounded : null;
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

async function transcribeYoutubeAudio(videoId, { prompt } = {}) {
  const download = await downloadYoutubeAudio(videoId);
  try {
    return await transcribeAudioWithWhisper(download.filePath, {
      prompt,
      language: "id",
    });
  } finally {
    await download?.cleanup?.().catch(() => {});
  }
}

export async function processYoutubeTranscriptionAction(input) {
  const parsed = processSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Harus login untuk memproses transcript.");
  }

  const videoId = extractVideoId(parsed.data.youtubeUrl);
  if (!videoId) {
    throw new Error("URL YouTube tidak valid");
  }

  let transcription = null;
  let lastError = null;

  try {
    transcription = await transcribeYoutubeAudio(videoId);
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  if (!transcription?.text) {
    try {
      const fallback = await fetchYoutubeTranscript(videoId);
      transcription = {
        text: fallback.text,
        srt: fallback.srt,
        segments: fallback.segments,
        lang: fallback.lang,
        language: fallback.lang,
        durationSeconds: estimateDurationSeconds(fallback.segments),
        model: null,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : lastError?.message || "Proses transcribe gagal.";
      throw new Error(`Gagal memproses audio YouTube: ${message}`);
    }
  }

  const durationSeconds =
    transcription?.durationSeconds ??
    estimateDurationSeconds(transcription?.segments ?? []) ??
    null;

  const saved = await saveTranscriptResult({
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    prompt: "",
    transcriptText: transcription?.text ?? "",
    srt: transcription?.srt ?? "",
    durationSeconds,
    model: transcription?.model ?? null,
    userId: session.user.id,
  });

  return {
    id: saved?.id ?? null,
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    transcript: transcription?.text ?? "",
    srt: transcription?.srt ?? "",
    model: transcription?.model ?? null,
    createdAt: saved?.created_at ?? null,
    lang: transcription?.lang ?? transcription?.language ?? null,
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
  const youtubeId = extractVideoId(audioUrl);
  if (youtubeId) {
    return transcribeYoutubeAudio(youtubeId, { prompt });
  }

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
