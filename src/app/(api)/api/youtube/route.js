import { NextResponse } from "next/server";

import { extractVideoId, fetchYoutubeMetadata } from "@/lib/youtube";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const url = searchParams.get("url");

  const videoId = id ?? (url ? extractVideoId(url) : null);

  if (!videoId) {
    return NextResponse.json(
      { error: "Provide ?id=<videoId> or ?url=<youtube-url>" },
      { status: 400 },
    );
  }

  try {
    const meta = await fetchYoutubeMetadata(videoId);
    return NextResponse.json({ id: meta.id, snippet: meta.snippet, contentDetails: meta.contentDetails });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch YouTube metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
