"use server";

import { z } from "zod";

import { saveTranscriptResult } from "@/lib/db";
import {
  generateMindmapFromTranscript,
  generateQaFromTranscript,
  generateSummaryFromTranscript,
  transcribeAudioStub,
} from "@/lib/openai";
import { extractVideoId, fetchYoutubeTranscript } from "@/lib/youtube";

const processSchema = z.object({
  youtubeUrl: z.string().url(),
});

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

  const saved = await saveTranscriptResult({
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    prompt: "",
    transcriptText: transcript.text,
    srt: transcript.srt,
    summary: null,
    qa: null,
    mindmap: null,
    model: "transcript-only",
  });

  return {
    id: saved?.id ?? null,
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    transcript: transcript.text,
    srt: transcript.srt,
    model: "transcript-only",
    createdAt: saved?.created_at ?? null,
    lang: transcript.lang,
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

const featureSchema = z.object({
  transcript: z.string().min(10, "Transcript kosong atau terlalu pendek."),
  prompt: z.string().optional(),
  videoTitle: z.string().optional(),
});

export async function summarizeTranscriptAction(input) {
  const parsed = featureSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const { transcript, prompt, videoTitle } = parsed.data;
  return generateSummaryFromTranscript(transcript, { prompt, videoTitle });
}

export async function generateQaAction(input) {
  const parsed = featureSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const { transcript, prompt, videoTitle } = parsed.data;
  return generateQaFromTranscript(transcript, { prompt, videoTitle });
}

export async function generateMindmapAction(input) {
  const parsed = featureSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error("Input tidak valid");
  }

  const { transcript, prompt, videoTitle } = parsed.data;
  return generateMindmapFromTranscript(transcript, { prompt, videoTitle });
}
