"use server";

import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { extractVideoId, fetchYoutubeMetadata } from "@/lib/youtube";

const exec = promisify(execFile);

const metaSchema = z.object({
  id: z.string().optional(),
  url: z.string().url().optional(),
});

export async function fetchYoutubeMetaAction(params) {
  const parsed = metaSchema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new Error("Parameter tidak valid");
  }

  let videoId = parsed.data.id ?? null;
  if (!videoId && parsed.data.url) {
    videoId = extractVideoId(parsed.data.url);
  }
  if (!videoId) {
    throw new Error("Berikan id atau url YouTube");
  }

  const meta = await fetchYoutubeMetadata(videoId);
  return { id: meta.id, snippet: meta.snippet, contentDetails: meta.contentDetails };
}

const ytdlpSchema = z.object({
  url: z.string().url(),
  format: z.string().optional(),
});

function sanitizeUrl(url) {
  const id = extractVideoId(url);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export async function ytdlpInfoAction(params) {
  const parsed = ytdlpSchema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new Error("Parameter tidak valid");
  }

  const safeUrl = sanitizeUrl(parsed.data.url);
  if (!safeUrl) {
    throw new Error("URL YouTube tidak valid");
  }

  const format = parsed.data.format ?? "bestvideo*+bestaudio/best";
  const ytDlpBin = process.env.YTDLP_PATH || "yt-dlp";

  const { stdout } = await exec(ytDlpBin, [
    "--dump-single-json",
    "--no-warnings",
    "--no-playlist",
    "-f",
    format,
    safeUrl,
  ]);

  const json = JSON.parse(stdout);

  return {
    id: json.id,
    title: json.title,
    duration: json.duration,
    thumbnails: json.thumbnails,
    uploader: json.uploader,
    webpage_url: json.webpage_url,
    requested_formats: json.requested_formats,
    formats: json.formats,
  };
}
