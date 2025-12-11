import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getTranscriptById } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(_req, { params }) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { error: "ID transcript wajib diisi." },
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
    if (!item) {
      return NextResponse.json(
        { error: "Transcript tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal mengambil transcript.",
      },
      { status: 500 },
    );
  }
}
