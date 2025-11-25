import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

import { extractVideoId } from "@/lib/youtube";

const exec = promisify(execFile);

const querySchema = z.object({
  url: z.string().url(),
  format: z.string().optional(), // e.g., "bestaudio" or "bestvideo"
});

function sanitizeUrl(url) {
  const id = extractVideoId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export async function GET(req) {
  const ytDlpBin = process.env.YTDLP_PATH || "yt-dlp";
  const searchParams = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = querySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const safeUrl = sanitizeUrl(parsed.data.url);
  if (!safeUrl) {
    return NextResponse.json({ error: "Invalid or unsupported YouTube URL" }, { status: 400 });
  }

  const format = parsed.data.format ?? "bestvideo*+bestaudio/best";

  try {
    const { stdout } = await exec(ytDlpBin, [
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "-f",
      format,
      safeUrl,
    ]);

    const json = JSON.parse(stdout);

    return NextResponse.json({
      id: json.id,
      title: json.title,
      duration: json.duration,
      thumbnails: json.thumbnails,
      uploader: json.uploader,
      webpage_url: json.webpage_url,
      requested_formats: json.requested_formats,
      formats: json.formats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "yt-dlp failed";
    return NextResponse.json(
      {
        error: "Failed to run yt-dlp",
        message,
        hint: "Ensure yt-dlp is installed and accessible (set YTDLP_PATH if needed).",
      },
      { status: 500 },
    );
  }
}
