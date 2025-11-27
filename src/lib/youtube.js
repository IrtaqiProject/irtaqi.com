import { execFile } from "node:child_process";
import { promisify } from "node:util";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const exec = promisify(execFile);
const YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";

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

function segmentsToSrt(segments) {
  return segments
    .map((seg, idx) => {
      const start = Number(seg.start ?? 0);
      const end = start + Number(seg.duration ?? 4);
      return `${idx + 1}\n${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}\n${seg.text || ""}\n`;
    })
    .join("\n");
}

function segmentsToPlainText(segments) {
  return segments
    .map((seg) => seg.text?.trim() || "")
    .filter(Boolean)
    .join(" ");
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
      const text = textLines.join(" ").trim();
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

function pickSubtitleTrack(info, langs) {
  const preferExt = ["vtt", "srt", "ttml", "srv3", "srv2", "srv1", "json3"];
  const uniqueLangs = [...new Set(langs)];

  for (const lang of uniqueLangs) {
    const variants = [lang, lang?.split("-")?.[0]].filter(Boolean);
    for (const variant of variants) {
      const candidates = [];
      const subs = info?.subtitles?.[variant] ?? [];
      const autos = info?.automatic_captions?.[variant] ?? [];
      for (const entry of [...subs, ...autos]) {
        if (!entry?.url) continue;
        candidates.push({
          url: entry.url,
          lang: variant,
          ext: entry.ext,
          source: subs.includes(entry) ? "subtitles" : "automatic_captions",
        });
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

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const indonesianLangs = ["id", "id-ID", "id-id", "in"];
  const langPrefs = [...new Set([lang, lang?.split("-")?.[0], ...indonesianLangs])].filter(Boolean);

  let lastError = null;

  for (const pref of langPrefs) {
    try {
      const info = await runYtDlpJson(url, pref);
      const available = listSubtitleLangs(info);
      const indoAvailable = available.filter((code) => code?.toLowerCase().startsWith("id") || code === "in");
      const trialLangs = [...new Set([pref, ...indoAvailable, ...available])];

      for (const trial of trialLangs) {
        const subtitle = pickSubtitleTrack(info, [trial]);
        if (!subtitle) {
          lastError = new Error(
            `Subtitle/auto-caption Bahasa Indonesia tidak tersedia. Subtitle tersedia: ${available.join(", ") || "-"}.`,
          );
          continue;
        }

        const res = await fetch(subtitle.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
            Referer: url,
            "Accept-Language": "id,en;q=0.9",
          },
        });
        if (!res.ok) {
          lastError = new Error(`Gagal mengunduh subtitle ${trial} (${res.status}).`);
          continue;
        }

        const body = await res.text();
        let segments = [];

        if (subtitle.ext === "vtt") {
          segments = parseVtt(body);
        } else if (subtitle.ext === "srt") {
          segments = parseSrt(body);
        } else if (subtitle.ext === "json3" || subtitle.ext?.startsWith("srv")) {
          segments = parseJson3(body);
        } else if (subtitle.ext === "ttml") {
          segments = parseTtml(body);
        } else {
          segments = parseVtt(body);
          if (!segments.length) segments = parseSrt(body);
        }

        if (!segments || !segments.length) {
          lastError = new Error(
            `Subtitle/SRT kosong atau gagal diparse untuk bahasa ${trial} (ext ${subtitle.ext || "unknown"}).`,
          );
          continue;
        }

        return {
          videoId,
          lang: subtitle.lang,
          segments,
          text: segmentsToPlainText(segments),
          srt: segmentsToSrt(segments),
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Subtitle/SRT tidak tersedia atau gagal diparse.");
}
