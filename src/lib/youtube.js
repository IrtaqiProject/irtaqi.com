const API_BASE = "https://www.googleapis.com/youtube/v3";

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

async function fetchTranscriptSegments(videoId, lang) {
  const params = new URLSearchParams({
    server_vid: videoId,
    format: "json",
    lang,
  });

  const url = `https://youtubetranscript.com/?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gagal mengambil transcript YouTube (${res.status}). Respon: ${body.slice(0, 120) || "tanpa body"}`,
    );
  }

  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    const snippet = raw.trim().slice(0, 120);
    throw new Error(
      `Endpoint transcript mengembalikan non-JSON (mungkin diblokir/HTML). Cuplikan: ${snippet || "empty"}`,
    );
  }

  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("Transcript tidak tersedia untuk video ini");
  }

  return json
    .map((item) => ({
      text: item.text?.trim() ?? "",
      start: Number(item.start ?? item.offset ?? 0),
      duration: Number(item.duration ?? item.dur ?? 4),
    }))
    .filter((item) => item.text.length > 0);
}

export async function fetchYoutubeTranscript(videoId, { lang = "id" } = {}) {
  if (!videoId) {
    throw new Error("Video ID tidak ditemukan.");
  }

  const attempts = [lang, "en"].filter(Boolean);
  let segments = null;
  let usedLang = lang;

  for (const attempt of attempts) {
    try {
      segments = await fetchTranscriptSegments(videoId, attempt);
      usedLang = attempt;
      break;
    } catch (err) {
      const isLastAttempt = attempt === attempts.at(-1);
      if (isLastAttempt) {
        throw err;
      }
    }
  }

  if (!segments) {
    throw new Error("Transcript tidak bisa diambil.");
  }

  return {
    videoId,
    lang: usedLang,
    segments,
    text: segmentsToPlainText(segments),
    srt: segmentsToSrt(segments),
  };
}
