import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { listTranscripts } from "@/lib/db";
import { authOptions } from "@/lib/auth";

function parseLimit(searchParams) {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return undefined;
  return parsed;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const items = await listTranscripts({
      limit,
      userId: session.user.id,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal mengambil data transcript.",
      },
      { status: 500 },
    );
  }
}
