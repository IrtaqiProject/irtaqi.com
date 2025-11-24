import { NextResponse } from "next/server";
import { z } from "zod";

import { transcribeAudioStub, transcribeWithWhisperAPI } from "@/lib/openai";

const bodySchema = z.object({
  audioUrl: z.string().url(),
  prompt: z.string().optional(),
});

export async function POST(req) {
  const authHeader = req.headers.get("x-internal-token");
  if (!authHeader || authHeader !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { audioUrl, prompt } = parsed.data;

  try {
    const transcription = process.env.WHISPER_API_KEY
      ? await transcribeWithWhisperAPI(audioUrl, { prompt, language: "id" })
      : await transcribeAudioStub(audioUrl, prompt);

    return NextResponse.json({ transcription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transcribe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
