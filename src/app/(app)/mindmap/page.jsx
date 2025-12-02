"use client";

import Link from "next/link";
import { useAtom } from "jotai";
import { Loader2, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { generateMindmapAction } from "@/actions/transcription";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildMindmapChart, sanitizeText } from "@/lib/mindmap";
import {
  mindmapChartAtom,
  mindmapPromptAtom,
  mindmapRenderErrorAtom,
  mindmapResultAtom,
  transcriptAtom,
  youtubeAtom,
} from "@/state/transcribe-atoms";

const navLinks = [
  { href: "/transcribe", label: "Transcribe" },
  { href: "/summarize", label: "Summarize" },
  { href: "/qa", label: "Q&A" },
  { href: "/mindmap", label: "Mindmap" },
];

export default function MindmapPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useAtom(mindmapPromptAtom);
  const [mindmapResult, setMindmapResult] =
    useAtom(mindmapResultAtom);
  const [mindmapChart, setMindmapChart] = useAtom(mindmapChartAtom);
  const [mindmapRenderError, setMindmapRenderError] = useAtom(
    mindmapRenderErrorAtom
  );
  const [transcript] = useAtom(transcriptAtom);
  const [youtubeUrl] = useAtom(youtubeAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const transcriptPreview =
    transcript?.transcript?.slice(0, 480) ?? "";
  const nodes = mindmapResult?.mindmap?.nodes ?? [];
  const outline = mindmapResult?.mindmap?.outline_markdown ?? "";

  useEffect(() => {
    if (status === "unauthenticated") {
      const params = new URLSearchParams(searchParams);
      params.set("callbackUrl", "/mindmap");
      router.replace(`/login?${params.toString()}`);
    }
  }, [status, router, searchParams]);

  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
        <p className="text-sm text-white/70">
          Mengalihkan ke halaman login...
        </p>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </main>
    );
  }

  const handleMindmap = async (e) => {
    e.preventDefault();
    if (!transcript?.transcript) {
      setError(
        "Transkrip belum diproses. Jalankan dulu di halaman Transcribe."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMindmapChart("");
    setMindmapRenderError("");

    try {
      const data = await generateMindmapAction({
        transcript: transcript.transcript,
        prompt,
        videoTitle: transcript.youtubeUrl || youtubeUrl || "Kajian",
      });
      setMindmapResult(data);
      const chart = buildMindmapChart(
        data?.mindmap?.nodes,
        data?.mindmap?.title ?? "Peta Pikiran Kajian"
      );
      if (!chart) {
        setMindmapRenderError(
          "Mind map belum bisa dibuat. Pastikan node tersedia."
        );
      } else {
        setMindmapChart(chart);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat mindmap"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-6 h-72 w-72 rounded-full bg-[#7a5bff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-0 h-80 w-80 rounded-full bg-[#4a9dff]/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-80 w-80 rounded-full bg-[#ff67d9]/18 blur-3xl" />
      </div>

      <div className="container relative max-w-4xl space-y-8 py-14 text-white">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {navLinks.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={
                item.href === "/mindmap" ? "default" : "outline"
              }
              className={
                item.href === "/mindmap"
                  ? ""
                  : "bg-white/10 text-white hover:bg-white/20"
              }
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>

        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-emerald-200">
            Langkah 4 · Mindmap
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Ubah catatan jadi peta pikiran yang rapi dan terstruktur
          </h1>
          <p className="text-white/75">
            Prompt mindmap dibuat terpisah. Lebih hemat, lebih
            terkontrol, lebih powerful.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Peta pikiran</CardTitle>
            <CardDescription className="text-white/80">
              Sesuaikan prompt untuk node, kedalaman cabang, atau gaya
              penamaan. Lalu render ke Mermaid di frontend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleMindmap}>
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt mindmap</span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Minta cabang utama, sub-topik, node dalil, dan catatan pendek untuk setiap node..."
                />
              </label>
              {error ? (
                <p className="text-sm text-amber-300">{error}</p>
              ) : null}
              {mindmapRenderError ? (
                <p className="text-sm text-amber-200">
                  {mindmapRenderError}
                </p>
              ) : null}
              {!transcript?.transcript ? (
                <p className="text-sm text-amber-200">
                  Transcript belum tersedia. Jalankan dulu halaman
                  Transcribe agar hasil bisa dipakai.
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={loading || !transcript?.transcript}
                className="w-full bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Buat mindmap
              </Button>
            </form>
          </CardContent>
        </Card>

        {nodes.length ? (
          <div className="space-y-4">
            <Card className="border-white/10 bg-white/10 text-white">
              <CardHeader>
                <CardTitle>Node mindmap</CardTitle>
                <CardDescription className="text-white/75">
                  Pemetaan tidak akan berjalan otomatis. List ini
                  muncul hanya setelah tombol dipencet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  {nodes.slice(0, 10).map((node, idx) => (
                    <div
                      key={node.id ?? node.label ?? idx}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <p className="text-xs font-mono text-white/70">
                        {node.id ?? `node-${idx + 1}`} ·{" "}
                        {sanitizeText(
                          node.label ?? node.title ?? "Node"
                        )}
                      </p>
                      {node.note ? (
                        <p className="text-sm text-white/80">
                          {node.note}
                        </p>
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
                {nodes.length > 10 ? (
                  <p className="text-xs text-white/60">
                    +{nodes.length - 10} node lain.
                  </p>
                ) : null}
                {outline ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">
                      Outline (Markdown)
                    </p>
                    <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs text-white/80">
                      {outline}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {mindmapChart ? (
              <MindmapCanvas
                chart={mindmapChart}
                title={
                  mindmapResult?.mindmap?.title ??
                  "Peta Pikiran Kajian"
                }
              />
            ) : null}
          </div>
        ) : null}

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Transcript aktif</CardTitle>
            <CardDescription className="text-white/75">
              Peta pikiran dibangun dari transcript yang sudah
              disimpan di halaman Transcribe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {transcript?.transcript ? (
              <>
                <p className="text-xs text-white/70">
                  Video {transcript.videoId ?? "–"}{" "}
                  {transcript.lang
                    ? `(${transcript.lang.toUpperCase()})`
                    : ""}{" "}
                  · {transcript.youtubeUrl ?? youtubeUrl ?? "-"}
                </p>
                <pre className="max-h-36 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/80">
                  {transcriptPreview}
                </pre>
              </>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/70">
                  Transcript belum ada. Mulai dari halaman Transcribe.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="bg-white/10 text-white hover:bg-white/20"
                >
                  <Link href="/transcribe">
                    Ke halaman Transcribe
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
