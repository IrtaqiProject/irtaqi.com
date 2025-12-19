import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { transcribeAudioFile } from "./openai";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const exec = promisify(execFile);
const YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";
const MIN_CUE_DURATION = 0.2; // 200ms
const MERGE_GAP_THRESHOLD = 0.8; // seconds
const OVERLAP_GAP_THRESHOLD = 1.2; // seconds
const STOPWORDS = new Set([
  "dan",
  "yang",
  "iya",
  "ya",
  "oh",
  "lah",
  "sih",
  "deh",
  "kok",
  "gitu",
  "atau",
  "jadi",
  "nah",
  "hmm",
  "emm",
  "eh",
  "uh",
  "oke",
  "okay",
  "ayo",
  "aja",
  "udah",
  "yaudah",
  "itu",
  "banget",
  "enggak",
  "nggak",
  "ngga",
  "tidak",
  "iyaa",
  "yaaa",
  "right",
  "yeah",
  "yup",
]);

export function extractVideoId(input) {
  const urlIdMatch = input.match(/[?&]v=([^&#]+)/)?.[1];
  const shortMatch = input.match(/youtu\.be\/([^?]+)/)?.[1];
  const embedMatch = input.match(/youtube\.com\/embed\/([^?]+)/)?.[1];
  const plainIdMatch = input.match(/^[a-zA-Z0-9_-]{11}$/)?.[0];

  return urlIdMatch ?? shortMatch ?? embedMatch ?? plainIdMatch ?? null;
}

export async function fetchYoutubeMetadata(id) {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is missing");
  }

  const url = `${API_BASE}/videos?part=snippet,contentDetails&id=${id}&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}`);
  }

  const data = await res.json();
  const video = data.items?.[0];
  if (!video) {
    throw new Error("Video not found");
  }

  return video;
}

function toSrtTimestamp(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function decodeEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function cleanCueText(text = "") {
  const decoded = decodeEntities(text);
  return decoded
    .replace(/\r/g, " ")
    .replace(/<\/?c[^>]*>/gi, " ") // buang tag <c>...</c>
    .replace(/<\d{2}:\d{2}:\d{2}[.,]\d{3}>/g, " ") // buang inline timestamp
    .replace(/<[^>]+>/g, " ") // buang tag html/vtt lainnya
    .replace(/\s+/g, " ")
    .trim();
}

function filterNoiseSegments(segments) {
  return (segments ?? []).filter((seg) => {
    const duration = Math.max(0, Number(seg?.duration ?? 0));
    if (duration < MIN_CUE_DURATION) return false;
    const words = (seg?.text ?? "").split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const stopwordHits = words.filter((w) => STOPWORDS.has(w.toLowerCase())).length;
    const stopwordOnly = stopwordHits === words.length;
    if (words.length < 3 && stopwordOnly) return false;
    if (words.length < 4 && stopwordHits / words.length >= 0.75) return false;
    return true;
  });
}

function wordOverlapScore(a, b) {
  const wordsA = new Set((a || "").split(/\s+/).filter(Boolean).map((w) => w.toLowerCase()));
  const wordsB = new Set((b || "").split(/\s+/).filter(Boolean).map((w) => w.toLowerCase()));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  return overlap / Math.min(wordsA.size, wordsB.size);
}

function normalizeSegments(inputSegments) {
  const cleaned = (inputSegments ?? [])
    .map((seg) => {
      const start = Number(seg?.start ?? 0);
      const duration = Math.max(0, Number(seg?.duration ?? 0));
      const text = cleanCueText(seg?.text ?? "");
      return { start, duration, text };
    })
    .filter((seg) => seg.text)
    .sort((a, b) => a.start - b.start);

  const filtered = filterNoiseSegments(cleaned);
  const merged = [];

  for (const seg of filtered) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...seg });
      continue;
    }

    const gap = seg.start - (prev.start + prev.duration);
    const closeEnough = gap <= OVERLAP_GAP_THRESHOLD;
    const prevText = prev.text.toLowerCase();
    const currText = seg.text.toLowerCase();
    const containsPrev = currText.includes(prevText);
    const containsCurr = prevText.includes(currText);
    const overlap = wordOverlapScore(prevText, currText);

    if (containsPrev && closeEnough) {
      prev.text = seg.text;
      prev.duration = Math.max(prev.duration, seg.start + seg.duration - prev.start);
      continue;
    }

    if (containsCurr && closeEnough) {
      prev.duration = Math.max(prev.duration, seg.start + seg.duration - prev.start);
      continue;
    }

    if (overlap >= 0.8 && closeEnough) {
      if (seg.text.length > prev.text.length) {
        prev.text = seg.text;
      }
      prev.duration = Math.max(prev.duration, seg.start + seg.duration - prev.start);
      continue;
    }

    merged.push({ ...seg });
  }

  return merged;
}

function segmentsToSrt(segments, { skipNormalize = false } = {}) {
  const list = skipNormalize ? segments ?? [] : normalizeSegments(segments);
  return list
    .map((seg, idx) => {
      const start = Number(seg.start ?? 0);
      const end = start + Number(seg.duration ?? 4);
      return `${idx + 1}\n${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}\n${seg.text || ""}\n`;
    })
    .join("\n");
}

function mergeSegmentsForParagraphs(list) {
  const merged = [];

  for (const seg of list) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...seg });
      continue;
    }

    const prevEnd = prev.start + prev.duration;
    const gap = Math.max(0, seg.start - prevEnd);
    const prevEndsSentence = /[.?!…:]$/.test(prev.text.trim());
    const shouldMerge = gap <= MERGE_GAP_THRESHOLD && !prevEndsSentence;

    if (shouldMerge) {
      prev.text = `${prev.text} ${seg.text}`.replace(/\s+/g, " ").trim();
      prev.duration = Math.max(prev.duration, seg.start + seg.duration - prev.start);
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.map((item) => item.text);
}

function segmentsToPlainText(segments, { skipNormalize = false } = {}) {
  const list = skipNormalize ? segments ?? [] : normalizeSegments(segments);
  const paragraphs = mergeSegmentsForParagraphs(list);
  return paragraphs.join("\n\n");
}

function parseVttTimestamp(ts) {
  const token = ts.trim().split(/\s+/)[0]; // buang pengaturan posisi/align
  const match = token.match(/(?:(\d+):)?(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/);
  if (!match) return 0;
  const [, h = "0", m, s, ms = "0"] = match;
  const millis = ms.padEnd(3, "0").slice(0, 3);
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(millis) / 1000;
}

function parseVtt(vtt) {
  const lines = vtt.replace(/\r/g, "").split("\n");
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith("WEBVTT")) {
      i += 1;
      continue;
    }
    if (line.includes("-->")) {
      const [startRaw, endRaw] = line.split("-->").map((s) => s.trim());
      const start = parseVttTimestamp(startRaw);
      const end = parseVttTimestamp(endRaw);
      i += 1;
      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i += 1;
      }
      const text = cleanCueText(textLines.join(" "));
      if (text) {
        segments.push({ start, duration: Math.max(0, end - start), text });
      }
    } else {
      i += 1;
    }
  }
  return segments;
}

function parseSrtTimestamp(ts) {
  if (!ts) return 0;
  const token = ts.trim().split(/\s+/)[0];
  const match = token.match(/(?:(\d+):)?(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  const [, h = "0", m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function parseSrt(srt) {
  const blocks = srt.replace(/\r/g, "").split("\n\n");
  const segments = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;
    const timingLine = lines.find((l) => l.includes("-->"));
    if (!timingLine) continue;
    const [startRaw, endRaw] = timingLine.split("-->").map((s) => s?.trim() ?? "");
    const start = parseSrtTimestamp(startRaw);
    const end = parseSrtTimestamp(endRaw);
    const textLines = lines.slice(timingLine === lines[0] ? 1 : 2);
    const text = textLines.join(" ").trim();
    if (text) {
      segments.push({ start, duration: Math.max(0, end - start), text });
    }
  }
  return segments;
}

function parseJson3(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const events = data.events ?? [];
    const segments = [];
    for (const ev of events) {
      const start = Number(ev.tStartMs ?? 0) / 1000;
      const duration = Number(ev.dDurationMs ?? 0) / 1000;
      const text = (ev.segs ?? [])
        .map((s) => s.utf8?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) {
        segments.push({ start, duration, text });
      }
    }
    return segments;
  } catch {
    return [];
  }
}

function parseTtml(ttml) {
  const segments = [];
  const regex = /<p[^>]*begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gim;
  let match;
  while ((match = regex.exec(ttml)) !== null) {
    const start = parseVttTimestamp(match[1] ?? "0:00:00.000");
    const end = parseVttTimestamp(match[2] ?? "0:00:00.000");
    const text = match[3]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";
    if (text) {
      segments.push({ start, duration: Math.max(0, end - start), text });
    }
  }
  return segments;
}

function parseSubtitleBody(subtitle, body) {
  if (subtitle.ext === "vtt") {
    return parseVtt(body);
  }
  if (subtitle.ext === "srt") {
    return parseSrt(body);
  }
  if (subtitle.ext === "json3" || subtitle.ext?.startsWith("srv")) {
    return parseJson3(body);
  }
  if (subtitle.ext === "ttml") {
    return parseTtml(body);
  }

  let segments = parseVtt(body);
  if (!segments.length) segments = parseSrt(body);
  return segments;
}

async function runYtDlpJson(url, lang) {
  try {
    const args = [
      "--dump-single-json",
      "--skip-download",
      "--write-auto-sub",
      "--sub-lang",
      lang,
      "--sub-format",
      "vtt",
      url,
    ];

    if (process.env.YTDLP_COOKIES_PATH) {
      args.splice(-1, 0, "--cookies", process.env.YTDLP_COOKIES_PATH);
    }

    const { stdout } = await exec(YTDLP_BIN, args);
    return JSON.parse(stdout);
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw new Error("yt-dlp tidak ditemukan. Install yt-dlp atau set YTDLP_PATH.");
    }
    throw new Error(`yt-dlp gagal: ${err?.message || "unknown error"}`);
  }
}

async function downloadYoutubeAudio(url) {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-audio-"));
    const outputTemplate = path.join(tempDir, "audio.%(ext)s");
    const args = ["--no-playlist", "-f", "bestaudio/best", "-o", outputTemplate, url];

    if (process.env.YTDLP_COOKIES_PATH) {
      args.splice(-1, 0, "--cookies", process.env.YTDLP_COOKIES_PATH);
    }

    await exec(YTDLP_BIN, args);
    const files = await fs.readdir(tempDir);
    const audioFile = files.find((name) => name.startsWith("audio."));
    if (!audioFile) {
      throw new Error("File audio tidak ditemukan setelah proses unduh.");
    }

    const audioPath = path.join(tempDir, audioFile);
    await fs.access(audioPath);

    return { audioPath, tempDir };
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw new Error("yt-dlp tidak ditemukan. Install yt-dlp atau set YTDLP_PATH.");
    }
    const rawMessage = err instanceof Error ? err.message : String(err);
    const message = rawMessage?.includes("ffprobe and ffmpeg not found")
      ? "Gagal mengunduh audio YouTube: ffmpeg/ffprobe tidak ditemukan. Install ffmpeg atau set --ffmpeg-location."
      : rawMessage;
    throw new Error(`Gagal mengunduh audio YouTube: ${message}`);
  }
}

function buildSegmentsFromFullText(text, durationSeconds) {
  const wordCount = text?.split(/\s+/)?.filter(Boolean)?.length ?? 0;
  const estimatedDuration = Math.max(5, Math.ceil(wordCount / 2)); // ~2 kata/detik
  const duration =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : estimatedDuration;

  return [
    {
      start: 0,
      duration,
      text: text ?? "",
    },
  ];
}

function pickSubtitleTrack(info, langs, { sourcePreference = ["subtitles", "automatic_captions"] } = {}) {
  const preferExt = ["vtt", "ttml", "srv3", "srv2", "srv1", "json3", "srt"];
  const uniqueLangs = [...new Set(langs)].filter(Boolean);
  const preferredSources =
    sourcePreference?.length > 0 ? sourcePreference : ["subtitles", "automatic_captions"];

  for (const lang of uniqueLangs) {
    const variants = [lang, lang?.split("-")?.[0]].filter(Boolean);
    for (const variant of variants) {
      const candidates = [];
      for (const source of preferredSources) {
        const entries =
          source === "subtitles"
            ? info?.subtitles?.[variant] ?? []
            : info?.automatic_captions?.[variant] ?? [];
        for (const entry of entries) {
          if (!entry?.url) continue;
          candidates.push({
            url: entry.url,
            lang: variant,
            ext: entry.ext,
            source,
          });
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => preferExt.indexOf(a.ext) - preferExt.indexOf(b.ext));
        return candidates[0];
      }
    }
  }
  return null;
}

function listSubtitleLangs(info) {
  const subLangs = Object.keys(info?.subtitles ?? {});
  const autoLangs = Object.keys(info?.automatic_captions ?? {});
  return [...new Set([...subLangs, ...autoLangs])];
}

export async function fetchYoutubeTranscript(videoId, { lang = "id" } = {}) {
  if (!videoId) {
    throw new Error("Video ID tidak ditemukan.");
  }

  const buildFallbackTranscript = (reason) => {
    const message =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? reason.message
          : "Subtitle/SRT tidak tersedia.";
    const text = `Transcript stub: ${message}. (Gunakan YTDLP_PATH/YOUTUBE_API_KEY dan pastikan subtitle tersedia untuk hasil asli.)`;
    const segments = [{ start: 0, duration: 5, text }];
    const normalized = normalizeSegments(segments);
    const paragraphs = mergeSegmentsForParagraphs(normalized);
    const plainText = segmentsToPlainText(normalized, { skipNormalize: true }) || text;
    return {
      videoId,
      lang: "id",
      segments: normalized,
      text: plainText,
      paragraphs,
      srt: segmentsToSrt(normalized, { skipNormalize: true }),
      vtt: null,
    };
  };

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const baseIndoLangs = ["id", "id-ID", "id-id", "in"];
  const indoLangs = [...new Set([lang, lang?.split("-")?.[0], ...baseIndoLangs])]
    .filter((code) => code && (code.toLowerCase().startsWith("id") || code === "in"));
  const englishFallbackLangs = ["en", "en-US", "en-GB"];

  const attempts = [
    {
      label: "Subtitle manual Indonesia",
      langs: indoLangs.length ? indoLangs : baseIndoLangs,
      sourcePreference: ["subtitles"],
      requestLang: indoLangs[0] ?? "id",
    },
    {
      label: "Auto subtitle Indonesia",
      langs: indoLangs.length ? indoLangs : baseIndoLangs,
      sourcePreference: ["automatic_captions"],
      requestLang: indoLangs[0] ?? "id",
    },
    {
      label: "Fallback bahasa Inggris",
      langs: englishFallbackLangs,
      sourcePreference: ["subtitles", "automatic_captions"],
      requestLang: englishFallbackLangs[0] ?? "en",
    },
  ];

  let lastError = null;
  const infoCache = new Map();

  const getInfo = async (preferredLang) => {
    const cacheKey = preferredLang || "default";
    if (infoCache.has(cacheKey)) return infoCache.get(cacheKey);
    const info = await runYtDlpJson(url, preferredLang);
    infoCache.set(cacheKey, info);
    return info;
  };

  for (const attempt of attempts) {
    try {
      const info = await getInfo(attempt.requestLang);
      const available = listSubtitleLangs(info);
      const subtitle = pickSubtitleTrack(info, attempt.langs, {
        sourcePreference: attempt.sourcePreference,
      });

      if (!subtitle) {
        lastError = new Error(
          `${attempt.label} tidak tersedia. Subtitle tersedia: ${available.join(", ") || "-"}.`,
        );
        continue;
      }

      const res = await fetch(subtitle.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          Referer: url,
          "Accept-Language": subtitle.lang ? `${subtitle.lang},id;q=0.9,en;q=0.8` : "id,en;q=0.9",
        },
      });
      if (!res.ok) {
        lastError = new Error(`Gagal mengunduh subtitle ${subtitle.lang || "unknown"} (${res.status}).`);
        continue;
      }

      const body = await res.text();
      const segments = parseSubtitleBody(subtitle, body);
      const normalizedSegments = normalizeSegments(segments);
      const paragraphs = mergeSegmentsForParagraphs(normalizedSegments);
      const plainText = segmentsToPlainText(normalizedSegments, { skipNormalize: true });

      if (!normalizedSegments || !normalizedSegments.length) {
        lastError = new Error(
          `${attempt.label} kosong atau gagal diparse untuk bahasa ${subtitle.lang || "unknown"} (ext ${
            subtitle.ext || "unknown"
          }).`,
        );
        continue;
      }

      return {
        videoId,
        lang: subtitle.lang,
        segments: normalizedSegments,
        text: plainText,
        paragraphs,
        srt: segmentsToSrt(normalizedSegments, { skipNormalize: true }),
        vtt: subtitle.ext === "vtt" ? body : null,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  try {
    const preferredLang = indoLangs[0] ?? "id";
    const info =
      infoCache.get(preferredLang) ?? infoCache.get("default") ?? (await getInfo(preferredLang));
    const durationSeconds =
      typeof info?.duration === "number"
        ? info.duration
        : Number.isFinite(Number(info?.duration))
          ? Number(info.duration)
          : null;

    const { audioPath, tempDir } = await downloadYoutubeAudio(url);
    try {
      const transcription = await transcribeAudioFile(audioPath, {
        prompt: "Transkripsi manual dari audio YouTube.",
        language: preferredLang,
      });

      const text = transcription?.text?.trim() ?? "";
      if (text) {
        const segments = buildSegmentsFromFullText(text, durationSeconds);
        const normalized = normalizeSegments(segments);
        const paragraphs = mergeSegmentsForParagraphs(normalized);
        const plainText = segmentsToPlainText(normalized, { skipNormalize: true }) || text;
        return {
          videoId,
          lang: preferredLang,
          segments: normalized,
          text: plainText,
          paragraphs,
          srt: segmentsToSrt(normalized, { skipNormalize: true }),
          vtt: null,
        };
      }

      lastError = new Error("Transkripsi OpenAI mengembalikan teks kosong.");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  console.warn(
    "[youtube] Subtitle fetch failed, fallback to stub transcript.",
    lastError instanceof Error ? lastError.message : String(lastError),
  );
  return buildFallbackTranscript(lastError);
}
