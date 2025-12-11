"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { GitBranch, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { MindmapCanvas } from "@/components/mindmap-canvas";
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
import { buildMindmapChart } from "@/lib/mindmap";
import {
  mindmapChartAtom,
  mindmapErrorAtom,
  mindmapProgressAtom,
  mindmapLoadingAtom,
  mindmapPromptAtom,
  mindmapResultAtom,
  transcriptResultAtom,
} from "@/state/transcribe-atoms";

export default function MindmapPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptResult] = useAtom(transcriptResultAtom);
  const [prompt, setPrompt] = useAtom(mindmapPromptAtom);
  const [mindmapResult, setMindmapResult] =
    useAtom(mindmapResultAtom);
  const [chart, setChart] = useAtom(mindmapChartAtom);
  const [loading, setLoading] = useAtom(mindmapLoadingAtom);
  const [error, setError] = useAtom(mindmapErrorAtom);
  const [mindmapProgress, setMindmapProgress] = useAtom(
    mindmapProgressAtom
  );
  const [streamingText, setStreamingText] = useState("");
  const mindmapProgressCtrl = useFeatureProgress(setMindmapProgress);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/mindmap");
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
  const nodes = mindmapResult?.nodes ?? [];
  const outline = mindmapResult?.outline_markdown ?? "";

  const renderChart = (nodesForMap, title) => {
    const built = buildMindmapChart(
      nodesForMap,
      title ?? "Peta Pikiran"
    );
    if (!built) {
      setError("Mind map belum bisa dibuat. Pastikan node valid.");
      setChart("");
      return;
    }
    setChart(built);
  };

  const handleGenerate = async () => {
    if (!transcriptReady) {
      setError("Proses transcript dulu di halaman transcribe.");
      return;
    }
    setLoading(true);
    setStreamingText("");
    setError("");
    setChart("");
    mindmapProgressCtrl.start();
    let tokenCount = 0;
    try {
      const data = await streamFeature(
        "mindmap",
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
            mindmapProgressCtrl.bump(
              Math.min(96, 18 + tokenCount * 2)
            );
            setStreamingText((prev) =>
              prev ? `${prev}${token}` : token
            );
          },
        }
      );
      setMindmapResult({ ...data.mindmap, model: data.model });
      renderChart(data.mindmap?.nodes ?? [], data.mindmap?.title);
      mindmapProgressCtrl.complete();
      setStreamingText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat mindmap"
      );
      setStreamingText("");
      mindmapProgressCtrl.fail();
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
      activeKey="mindmap"
      title="Visualisasikan struktur kajian dengan mindmap interaktif"
      subtitle="Cukup pakai prompt mindmap, cabang utama, dalil, dan contoh akan tersusun rapi otomatis. Mudah dilihat, enak dipahami."
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
              <CardTitle>Atur prompt mindmap</CardTitle>
              <CardDescription className="text-white/75">
                Transcript:{" "}
                {transcriptResult.videoId ?? "tidak dikenal"} · Durasi{" "}
                {metaText}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt mindmap</span>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Minta cabang utama, dalil, dan contoh yang ingin digambar."
                />
              </label>
              {error ? (
                <p className="text-sm text-amber-300">{error}</p>
              ) : null}
              {mindmapProgress > 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <ProgressBar
                    value={mindmapProgress}
                    label="Membangun mindmap"
                  />
                  <p className="mt-2 text-xs text-white/60">
                    Menyusun node hierarkis dan outline dari
                    transcript.
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
                  <GitBranch className="mr-2 h-4 w-4" />
                )}
                Buat mindmap
              </Button>
            </CardContent>
          </Card>

          {nodes.length ? (
            <div className="space-y-4">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Node mindmap</CardTitle>
                  <CardDescription className="text-white/75">
                    Model: {mindmapResult?.model ?? "tidak diketahui"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {nodes.slice(0, 8).map((node, idx) => (
                      <div
                        key={node.id ?? node.label ?? `node-${idx}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
                      >
                        <p className="font-mono text-xs text-white/70">
                          ID: {node.id ?? `node-${idx + 1}`}
                        </p>
                        <p className="font-semibold text-white">
                          {node.label ?? node.title ?? "Node"}
                        </p>
                        {node.note ? (
                          <p className="text-white/70">{node.note}</p>
                        ) : null}
                        <p className="text-xs text-white/60">
                          Children:{" "}
                          {Array.isArray(node.children) &&
                          node.children.length
                            ? node.children.join(", ")
                            : "Tidak ada"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {nodes.length > 8 ? (
                    <p className="text-xs text-white/60">
                      +{nodes.length - 8} node lain
                    </p>
                  ) : null}
                  {outline ? (
                    <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
                      <p className="font-semibold text-white">
                        Outline mindmap (Markdown)
                      </p>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-white/70">
                        {outline}
                      </pre>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {chart ? (
                <MindmapCanvas
                  chart={chart}
                  title={mindmapResult?.title ?? "Peta Pikiran"}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </StepLayout>
  );
}
