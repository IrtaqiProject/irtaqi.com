import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueTranscriptionJob } from "@/lib/queue";
import { extractVideoId } from "@/lib/youtube";

const bodySchema = z.object({
  videoId: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
  prompt: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json();
  const body = bodySchema.safeParse(json);

  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { audioUrl, youtubeUrl, prompt } = body.data;
  const videoId = body.data.videoId ?? (youtubeUrl ? extractVideoId(youtubeUrl) : null);

  if (!videoId && !audioUrl) {
    return NextResponse.json(
      { error: "Provide either videoId/youtubeUrl or audioUrl" },
      { status: 400 },
    );
  }

  const job = await enqueueTranscriptionJob({ videoId: videoId ?? undefined, audioUrl, prompt });
  const state = await job.getState();

  return NextResponse.json({ jobId: job.id, state }, { status: 202 });
}
