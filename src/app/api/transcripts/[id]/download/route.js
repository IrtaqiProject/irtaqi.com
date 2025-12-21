import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getTranscriptById } from "@/lib/db";
import {
  buildPdfDocument,
  buildWordDocument,
  cleanTranscriptText,
  splitTranscriptIntoParagraphs,
} from "@/lib/transcript-format";
import { authOptions } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

function resolveFormat(searchParams) {
  const format = searchParams.get("format")?.toLowerCase() ?? "";
  if (["pdf"].includes(format)) return "pdf";
  if (["word", "doc", "docx"].includes(format)) return "word";
  return null;
}

function buildFileName(id, format) {
  const ext = format === "pdf" ? "pdf" : "doc";
  return `transcript-${id}.${ext}`;
}

export async function GET(req, ctx) {
  const params = await resolveParams(ctx?.params);
  const id = params?.id;
  const format = resolveFormat(new URL(req.url).searchParams);

  if (!id) {
    return NextResponse.json(
      { error: "ID transcript wajib diisi." },
      { status: 400 },
    );
  }

  if (!format) {
    return NextResponse.json(
      { error: "Format tidak valid. Gunakan pdf atau word." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const item = await getTranscriptById(id, {
      includeText: true,
      userId: session.user.id,
    });

    if (!item?.transcript) {
      return NextResponse.json(
        { error: "Transcript belum tersedia atau kosong." },
        { status: 404 },
      );
    }

    const cleaned = cleanTranscriptText(item.transcript);
    if (!cleaned) {
      return NextResponse.json(
        { error: "Transcript kosong setelah dibersihkan." },
        { status: 400 },
      );
    }

    const paragraphs = splitTranscriptIntoParagraphs(cleaned);
    const title =
      item.youtube_url ??
      item.youtubeUrl ??
      item.video_id ??
      item.videoId ??
      "Transcript";

    const body =
      format === "pdf"
        ? buildPdfDocument({ title, paragraphs })
        : buildWordDocument({ title, paragraphs });

    const headers = {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/msword",
      "Content-Disposition": `attachment; filename="${buildFileName(id, format)}"`,
    };

    return new NextResponse(body, { headers });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyiapkan berkas transcript.",
      },
      { status: 500 },
    );
  }
}
