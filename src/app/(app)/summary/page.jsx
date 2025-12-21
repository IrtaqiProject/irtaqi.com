"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepLayout } from "@/components/step-layout";
import { streamFeature } from "@/lib/feature-stream-client";
import { useFeatureProgress } from "@/lib/use-progress";
import { cn } from "@/lib/utils";
import {
  summaryErrorAtom,
  summaryLoadingAtom,
  summaryProgressAtom,
  summaryPromptAtom,
  summaryResultAtom,
  transcriptResultAtom,
} from "@/state/transcribe-atoms";
import { summaryStreamingAtom } from "@/state/ui-atoms";

export default function SummaryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptResult, setTranscriptResult] = useAtom(
    transcriptResultAtom
  );
  const [prompt, setPrompt] = useAtom(summaryPromptAtom);
  const [summaryResult, setSummaryResult] =
    useAtom(summaryResultAtom);
  const [loading, setLoading] = useAtom(summaryLoadingAtom);
  const [error, setError] = useAtom(summaryErrorAtom);
  const [summaryProgress, setSummaryProgress] = useAtom(
    summaryProgressAtom
  );
  const [streamingText, setStreamingText] = useAtom(summaryStreamingAtom);
  const summaryProgressCtrl = useFeatureProgress(setSummaryProgress);

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
        <p className="text-sm text-white/70">
          Mengalihkan ke halaman login...
        </p>
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
    setStreamingText("");
    setError("");
    summaryProgressCtrl.start();
    let tokenCount = 0;
    try {
      const data = await streamFeature(
        "summary",
        {
          transcript: transcriptResult.transcript,
          prompt,
          youtubeUrl: transcriptResult.youtubeUrl,
          videoId: transcriptResult.videoId,
          transcriptId: transcriptResult.id,
          durationSeconds: transcriptResult.durationSeconds ?? null,
        },
        {
          onToken: (token) => {
            tokenCount += 1;
            summaryProgressCtrl.bump(
              Math.min(96, 20 + tokenCount * 2)
            );
            setStreamingText((prev) =>
              prev ? `${prev}${token}` : token
            );
          },
        }
      );
      if (data.transcriptId) {
        setTranscriptResult((prev) =>
          prev ? { ...prev, id: data.transcriptId } : prev
        );
      }
      if (data?.account) setAccount(data.account);
      setSummaryResult({ ...data.summary, model: data.model });
      summaryProgressCtrl.complete();
      setStreamingText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat ringkasan"
      );
      setStreamingText("");
      summaryProgressCtrl.fail();
    } finally {
      setLoading(false);
    }
  };

  const durationSeconds = transcriptResult?.durationSeconds;
  const metaText = durationSeconds
    ? `${Math.round(durationSeconds / 60)} menit`
    : "?";

  return (
    <StepLayout
      activeKey="summary"
      title="Ubah transcript panjang jadi ringkasan padat dan mudah dipahami!"
      subtitle="Tekan Summarize sekarang dan biarkan sistem merangkumkan semuanya untuk Anda."
    >
      {!transcriptReady ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Transcript belum tersedia</CardTitle>
            <CardDescription className="text-white/75">
              Proses &amp; simpan URL di langkah transcribe terlebih
              dahulu, lalu kembali ke sini.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/transcribe">Ke halaman transcribe</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.back()}
              className="bg-white/15 text-white"
            >
              Kembali
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-white/10 bg-white/5 text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Atur prompt ringkasan</CardTitle>
              <CardDescription className="text-white/75">
                Transcript:{" "}
                {transcriptResult.videoId ?? "tidak dikenal"} · Durasi{" "}
                {metaText}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">
                  Prompt ringkasan
                </span>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Tekankan poin praktis, dalil, atau insight lain."
                />
              </label>
              {error ? (
                <p className="text-sm text-amber-300">{error}</p>
              ) : null}
              {summaryProgress > 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <ProgressBar
                    value={summaryProgress}
                    label="Membuat ringkasan"
                  />
                  <p className="mt-2 text-xs text-white/60">
                    Mengambil konteks transcript dan menyusun bullet
                    points.
                  </p>
                </div>
              ) : null}
              {(loading || streamingText) && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                    Streaming token
                  </p>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-white/80">
                    {streamingText || "Menunggu token..."}
                  </pre>
                </div>
              )}
              <Button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className={cn(
                  "w-full bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand"
                )}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Buat ringkasan{" "}
              </Button>
            </CardContent>
          </Card>

          {summaryResult ? (
            <div className="space-y-4">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Ringkasan singkat</CardTitle>
                  <CardDescription className="text-white/75">
                    Model: {summaryResult.model ?? "tidak diketahui"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-lg font-semibold text-white">
                    {summaryResult.short ?? "Belum ada ringkasan."}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Bullet points
                    </p>
                    {bulletPoints.length ? (
                      <ul className="list-inside list-disc space-y-1 text-sm text-white/80">
                        {bulletPoints.map((point) => (
                          <li key={point.slice(0, 40)}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-white/60">
                        Belum ada bullet points.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {summaryResult.detailed ? (
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Ringkasan detail</CardTitle>
                    <CardDescription className="text-white/75">
                      Versi panjang untuk catatan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-white/80">
                      {summaryResult.detailed}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </StepLayout>
  );
}
