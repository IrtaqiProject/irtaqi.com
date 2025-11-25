import { notFound } from "next/navigation";

import { getTranscriptAction } from "@/actions/transcription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const gradientBg = "bg-gradient-to-b from-[#11092c] via-[#0f0a26] to-[#09071b]";

export const dynamic = "force-dynamic";

export default async function TranscriptDetailPage({ params }) {
  const jobId = params?.jobId;
  const data = await getTranscriptAction({ jobId }).catch(() => null);

  if (!data) return notFound();

  return (
    <main className={cn("relative min-h-screen overflow-hidden text-white", gradientBg)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-80 w-80 rounded-full bg-[#7b5dff]/25 blur-3xl" />
        <div className="absolute right-[-5%] top-20 h-72 w-72 rounded-full bg-[#ff7a6a]/20 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[25%] h-96 w-96 rounded-full bg-[#5ac8ff]/18 blur-3xl" />
      </div>

      <div className="container relative space-y-8 py-14">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-200">Transkrip</p>
          <h1 className="text-3xl font-bold leading-tight">Job #{jobId}</h1>
          <p className="text-white/70">Status: {data.status ?? data.state ?? "unknown"}</p>
        </div>

        <Card className="border-white/10 bg-white/5 text-white shadow-[0_20px_80px_rgba(16,12,60,0.5)] backdrop-blur">
          <CardHeader>
            <CardTitle>Detail</CardTitle>
            <CardDescription className="text-white/70">Hasil transkrip terbaru.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.transcript?.text ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Transcript</p>
                <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-white/90">
                  {data.transcript.text}
                </div>
              </div>
            ) : (
              <p className="text-amber-200">Belum ada transkrip. Status: {data.status}</p>
            )}
            {data.error ? (
              <p className="text-sm text-amber-300">Error: {data.error}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Created</p>
                <p>{data.createdAt ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Updated</p>
                <p>{data.updatedAt ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
