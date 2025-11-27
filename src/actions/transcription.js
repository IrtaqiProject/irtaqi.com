"use server";

import { z } from "zod";

import { saveTranscriptResult } from "@/lib/db";
import { generateInsightsFromTranscript, transcribeAudioStub } from "@/lib/openai";
import { extractVideoId, fetchYoutubeTranscript } from "@/lib/youtube";

const processSchema = z.object({
  youtubeUrl: z.string().url(),
  prompt: z.string().optional(),
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
  const insights = await generateInsightsFromTranscript(transcript.text, {
    prompt: parsed.data.prompt,
    videoTitle: `https://www.youtube.com/watch?v=${videoId}`,
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
    model: insights.model,
  });

  return {
    id: saved?.id ?? null,
    videoId,
    youtubeUrl: parsed.data.youtubeUrl,
    summary: insights.summary,
    qa: insights.qa,
    mindmap: insights.mindmap,
    transcript: transcript.text,
    srt: transcript.srt,
    model: insights.model,
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
