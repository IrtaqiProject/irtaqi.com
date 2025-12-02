"use server";

import { z } from "zod";

import { saveTranscriptResult } from "@/lib/db";
import { generateInsightsFromTranscript, transcribeAudioStub } from "@/lib/openai";
import { extractVideoId, fetchYoutubeTranscript } from "@/lib/youtube";

const processSchema = z.object({
  youtubeUrl: z.string().url(),
  prompt: z.string().optional(),
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
  const quizCount = decideQuizCount(durationSeconds);

  const insights = await generateInsightsFromTranscript(transcript.text, {
    prompt: parsed.data.prompt,
    videoTitle: `https://www.youtube.com/watch?v=${videoId}`,
    quizCount,
    durationSeconds,
  });

  const saved = await saveTranscriptResult({
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    prompt: parsed.data.prompt ?? "",
    transcriptText: transcript.text,
    srt: transcript.srt,
    summary: insights.summary,
    qa: insights.qa,
    mindmap: insights.mindmap,
    quiz: insights.quiz,
    durationSeconds,
    model: insights.model,
  });

  return {
    id: saved?.id ?? null,
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    summary: insights.summary,
    qa: insights.qa,
    mindmap: insights.mindmap,
    quiz: insights.quiz,
    transcript: transcript.text,
    srt: transcript.srt,
    model: insights.model,
    createdAt: saved?.created_at ?? null,
    lang: transcript.lang,
    quizCount,
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
