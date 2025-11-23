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
