"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { generateSummaryAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  summaryErrorAtom,
  summaryLoadingAtom,
  summaryPromptAtom,
  summaryResultAtom,
  transcriptResultAtom,
} from "@/state/transcribe-atoms";

export default function SummaryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptResult] = useAtom(transcriptResultAtom);
  const [prompt, setPrompt] = useAtom(summaryPromptAtom);
  const [summaryResult, setSummaryResult] = useAtom(summaryResultAtom);
  const [loading, setLoading] = useAtom(summaryLoadingAtom);
  const [error, setError] = useAtom(summaryErrorAtom);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/summary");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
        <p className="text-sm text-white/70">Mengalihkan ke halaman login...</p>
      </main>
    );
  }

  const transcriptReady = Boolean(transcriptResult?.transcript);
  const bulletPoints = summaryResult?.bullet_points ?? [];

  const handleGenerate = async () => {
    if (!transcriptReady) {
      setError("Proses transcript dulu di halaman transcribe.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await generateSummaryAction({
        transcript: transcriptResult.transcript,
        prompt,
        youtubeUrl: transcriptResult.youtubeUrl,
        videoId: transcriptResult.videoId,
        durationSeconds: transcriptResult.durationSeconds ?? null,
      });
      setSummaryResult({ ...data.summary, model: data.model });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat ringkasan");
    } finally {
      setLoading(false);
    }
  };

  if (!transcriptReady) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] px-4 text-white">
        <Card className="max-w-lg border-white/10 bg-white/10 text-white">
          <CardHeader>
            <CardTitle>Transcript belum tersedia</CardTitle>
            <CardDescription className="text-white/75">
              Buka halaman transcribe, proses &amp; simpan URL YouTube, lalu kembali ke sini untuk membuat ringkasan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/transcribe">Ke halaman transcribe</Link>
            </Button>
            <Button variant="secondary" onClick={() => router.back()} className="bg-white/15 text-white">
              Kembali
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] pb-16 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#7a5bff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-0 h-80 w-80 rounded-full bg-[#4a9dff]/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-80 w-80 rounded-full bg-[#ff67d9]/18 blur-3xl" />
      </div>

      <div className="container relative max-w-4xl space-y-6 py-14">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold text-emerald-200">Ringkas transcript</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Prompt khusus untuk ringkasan</h1>
          <p className="text-white/75">
            Jalankan hanya ketika siap. Prompt di bawah hanya memengaruhi ringkasan, tidak memengaruhi Q&amp;A, mindmap,
            atau quiz.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Atur prompt ringkasan</CardTitle>
            <CardDescription className="text-white/75">
              Transcript: {transcriptResult.videoId ?? "tidak dikenal"} · Durasi{" "}
              {transcriptResult.durationSeconds ? `${Math.round(transcriptResult.durationSeconds / 60)} menit` : "?"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="text-white/80">Prompt ringkasan</span>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:outline-none"
                placeholder="Tekankan poin praktis, dalil, atau insight lain."
              />
            </label>
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
            <Button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className={cn(
                "w-full bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand",
              )}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Jalankan ringkasan
            </Button>
          </CardContent>
        </Card>

        {summaryResult ? (
          <div className="space-y-4">
            <Card className="border-white/10 bg-white/10 text-white">
              <CardHeader>
                <CardTitle>Ringkasan singkat</CardTitle>
                <CardDescription className="text-white/75">
                  Model: {summaryResult.model ?? "tidak diketahui"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-lg font-semibold text-white">{summaryResult.short ?? "Belum ada ringkasan."}</p>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Bullet points</p>
                  {bulletPoints.length ? (
                    <ul className="list-inside list-disc space-y-1 text-sm text-white/80">
                      {bulletPoints.map((point) => (
                        <li key={point.slice(0, 40)}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/60">Belum ada bullet points.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {summaryResult.detailed ? (
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Ringkasan detail</CardTitle>
                  <CardDescription className="text-white/75">Versi panjang untuk catatan.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-white/80">{summaryResult.detailed}</p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
