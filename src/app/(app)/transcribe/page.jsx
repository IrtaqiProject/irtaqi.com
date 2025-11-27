"use client";

import { useAtom } from "jotai";
import { Loader2, PlayCircle, Wand2, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { processYoutubeTranscriptionAction } from "@/actions/transcription";
import { MindmapCanvas } from "@/components/mindmap-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { errorAtom, loadingAtom, promptAtom, resultAtom, youtubeAtom } from "@/state/transcribe-atoms";

function sanitizeLabel(label, fallback = "Node") {
  const clean = (label ?? "").toString().replace(/\s+/g, " ").replace(/["<>]/g, "").trim();
  return clean || fallback;
}

function buildMindmapChart(nodes = [], title = "Peta Pikiran") {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  const usedIds = new Set();
  const makeSafeId = (value, fallback) => {
    const base = (value ?? "").toString().trim() || fallback;
    const safeBase = base.replace(/[^a-zA-Z0-9_]/g, "_") || fallback;
    let candidate = safeBase;
    let counter = 1;
    while (usedIds.has(candidate)) {
      candidate = `${safeBase}_${counter}`;
      counter += 1;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const map = new Map();
  nodes.forEach((node, idx) => {
    const key = node?.id ?? `node_${idx}`;
    map.set(key, {
      safeId: makeSafeId(key, `node_${idx}`),
      label: sanitizeLabel(node?.label ?? node?.title, `Node ${idx + 1}`),
      children: Array.isArray(node?.children) ? node.children.filter(Boolean) : [],
    });
  });

  for (const node of map.values()) {
    for (const child of node.children) {
      if (!map.has(child)) {
        map.set(child, {
          safeId: makeSafeId(child, `child_${map.size}`),
          label: sanitizeLabel(child, "Subtopik"),
          children: [],
        });
      }
    }
  }

  const keys = Array.from(map.keys());
  const referenced = new Set();
  map.forEach((node) => node.children.forEach((child) => referenced.add(child)));
  const rootKey = map.has("root") ? "root" : keys.find((key) => !referenced.has(key)) ?? keys[0];
  if (!rootKey) return null;

  const rootNode = map.get(rootKey);
  if (rootNode) {
    rootNode.label = sanitizeLabel(title, rootNode.label || "Peta Pikiran");
  }

  const lines = ["graph TD"];
  const defined = new Set();
  const visited = new Set();

  const defineNode = (key) => {
    if (defined.has(key)) return;
    const node = map.get(key);
    if (!node) return;
    defined.add(key);
    lines.push(`  ${node.safeId}["${node.label}"]`);
  };

  const walk = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const node = map.get(key);
    if (!node) return;
    defineNode(key);
    for (const childKey of node.children) {
      defineNode(childKey);
      const childNode = map.get(childKey);
      lines.push(`  ${node.safeId} --> ${childNode?.safeId ?? makeSafeId(childKey, "child")}`);
      walk(childKey);
    }
  };

  walk(rootKey);

  for (const key of map.keys()) {
    if (key === rootKey || visited.has(key)) continue;
    defineNode(key);
    const rootSafe = map.get(rootKey)?.safeId ?? "root";
    const node = map.get(key);
    lines.push(`  ${rootSafe} --> ${node?.safeId ?? makeSafeId(key, "node")}`);
  }

  return lines.join("\n");
}

export default function TranscribePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [youtubeUrl, setYoutubeUrl] = useAtom(youtubeAtom);
  const [prompt, setPrompt] = useAtom(promptAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [result, setResult] = useAtom(resultAtom);
  const [error, setError] = useAtom(errorAtom);
  const [mindmapChart, setMindmapChart] = useState("");
  const [mindmapError, setMindmapError] = useState("");
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const bulletPoints = result?.summary?.bullet_points ?? [];
  const questions = result?.qa?.sample_questions ?? [];
  const mindmapNodes = result?.mindmap?.nodes ?? [];
  const transcriptPreview = result?.transcript?.slice(0, 1200) ?? "";
  const srtPreview = result?.srt?.slice(0, 400) ?? "";

  useEffect(() => {
    if (status === "unauthenticated") {
      const params = new URLSearchParams(searchParams);
      params.set("callbackUrl", "/transcribe");
      router.replace(`/login?${params.toString()}`);
    }
  }, [status, router, searchParams]);

  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
        <p className="text-sm text-white/70">Mengalihkan ke halaman login...</p>
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMindmapChart("");
    setMindmapError("");
    setResult(null);
    try {
      const data = await processYoutubeTranscriptionAction({ youtubeUrl, prompt });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses transcript");
    } finally {
      setLoading(false);
    }
  };

  const handleBuildMindmap = () => {
    setMindmapLoading(true);
    setMindmapError("");
    setMindmapChart("");

    try {
      const nodesForMap =
        mindmapNodes.length > 0
          ? mindmapNodes
          : bulletPoints.length
            ? [
                {
                  id: "root",
                  label: result?.summary?.short ?? "Topik Utama",
                  children: bulletPoints.map((_, idx) => `bp_${idx + 1}`),
                },
                ...bulletPoints.map((point, idx) => ({
                  id: `bp_${idx + 1}`,
                  label: point,
                  children: [],
                })),
              ]
            : [];

      const chart = buildMindmapChart(nodesForMap, result?.mindmap?.title ?? "Peta Pikiran");
      if (!chart) {
        setMindmapError("Mindmap belum bisa dibuat. Pastikan ringkasan sudah tersedia.");
        return;
      }
      setMindmapChart(chart);
    } catch (err) {
      setMindmapError(err instanceof Error ? err.message : "Gagal membuat peta pikiran");
    } finally {
      setMindmapLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#7a5bff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-0 h-80 w-80 rounded-full bg-[#4a9dff]/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-80 w-80 rounded-full bg-[#ff67d9]/18 blur-3xl" />
      </div>

      <div className="container relative max-w-4xl space-y-8 py-14 text-white">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-emerald-200">Transcribe kajian</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Masukkan URL YouTube untuk diproses</h1>
          <p className="text-white/75">
            URL dikirim ke server action Next.js: ambil transcript/SRT, kirim ke LLM untuk ringkasan + Q&amp;A +
            mindmap, simpan ke Postgres, lalu hasilnya langsung dikembalikan. Tidak ada antrean, Redis, atau worker
            terpisah.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Form transkripsi</CardTitle>
            <CardDescription className="text-white/80">
              URL dipangkas ke videoId, transcript diambil, diproses LLM, lalu disimpan di Postgres dalam satu alur
              server action/API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">URL YouTube</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <PlayCircle className="h-5 w-5 text-white/60" />
                  <input
                    required
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-transparent text-white placeholder:text-white/60 focus:outline-none"
                  />
                </div>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt (opsional)</span>
                <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <Wand2 className="mt-1 h-5 w-5 text-white/60" />
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full bg-transparent text-white placeholder:text-white/60 focus:outline-none"
                    placeholder="Highlight ayat, hadits, poin praktis..."
                  />
                </div>
              </label>
              {error ? <p className="text-sm text-amber-300">{error}</p> : null}
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand",
                )}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Proses & simpan
              </Button>
            </form>
            {result ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 text-sm shadow-inner">
                  <p className="font-semibold text-emerald-200">Hasil diproses di server</p>
                  <p className="text-white/80">
                    Disimpan ke Postgres dengan ID <span className="font-mono">{result.id ?? "–"}</span>. Model:{" "}
                    {result.model ?? "stub"}.
                  </p>
                  <p className="mt-2 text-xs text-white/60">
                    Video {result.videoId} {result.lang ? `(${result.lang.toUpperCase()})` : ""} · {result.youtubeUrl}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-white/10 bg-white/10 text-white">
                    <CardHeader>
                      <CardTitle>Ringkas</CardTitle>
                      <CardDescription className="text-white/75">
                        {result.summary?.short ?? "Ringkasan singkat tidak tersedia."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bulletPoints.length ? (
                        <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
                          {bulletPoints.map((point) => (
                            <li key={point.slice(0, 40)}>{point}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/60">Belum ada bullet points.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/10 text-white">
                    <CardHeader>
                      <CardTitle>Q&amp;A</CardTitle>
                      <CardDescription className="text-white/75">
                        Contoh pertanyaan untuk belajar cepat.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {questions.length ? (
                        <ul className="space-y-2 text-sm text-white/80">
                          {questions.map((item, idx) => (
                            <li key={`${item.question}-${idx}`}>
                              <p className="font-semibold">Q: {item.question}</p>
                              <p className="text-white/70">A: {item.answer}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/60">Belum ada contoh Q&amp;A.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/10 text-white">
                    <CardHeader>
                      <CardTitle>Mindmap</CardTitle>
                      <CardDescription className="text-white/75">
                        Daftar node untuk digambar di frontend.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mindmapNodes.length ? (
                        <ul className="space-y-1 text-sm text-white/80">
                          {mindmapNodes.slice(0, 6).map((node, idx) => (
                            <li
                              key={node.id ?? node.label ?? node.title ?? idx}
                              className="flex items-center gap-2"
                            >
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-mono text-white/80">
                                {node.id ?? `node-${idx + 1}`}
                              </span>
                              <span>{node.label ?? node.title ?? "Node"}</span>
                            </li>
                          ))}
                          {mindmapNodes.length > 6 ? (
                            <li className="text-xs text-white/60">+{mindmapNodes.length - 6} node lain</li>
                          ) : null}
                        </ul>
                      ) : (
                        <p className="text-sm text-white/60">Belum ada node mindmap.</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleBuildMindmap}
                        disabled={!result || mindmapLoading || (!mindmapNodes.length && !bulletPoints.length)}
                        className="w-full justify-center bg-white/15 text-white hover:bg-white/20"
                      >
                        {mindmapLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Buat Peta Pikiran
                      </Button>
                      {mindmapError ? <p className="text-xs text-amber-200">{mindmapError}</p> : null}
                    </CardContent>
                  </Card>
                </div>

                {mindmapChart ? (
                  <MindmapCanvas
                    chart={mindmapChart}
                    title={result?.mindmap?.title ?? "Peta Pikiran Kajian"}
                  />
                ) : null}

                {result.summary?.detailed ? (
                  <Card className="border-white/10 bg-white/10 text-white">
                    <CardHeader>
                      <CardTitle>Ringkasan detail</CardTitle>
                      <CardDescription className="text-white/75">Versi panjang untuk catatan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-white/80">{result.summary.detailed}</p>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Transcript &amp; SRT</CardTitle>
                    <CardDescription className="text-white/75">
                      Disimpan penuh di server, berikut cuplikan untuk verifikasi.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Transcript</p>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/80">
                        {transcriptPreview || "Belum ada transcript."}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">SRT</p>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/70">
                        {srtPreview || "Belum ada SRT."}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "1. Kirim URL", desc: "Server action menerima URL YouTube + prompt opsional." },
            { title: "2. Transcript + LLM", desc: "Ambil transcript/SRT, ringkas + Q&A + mindmap via LLM." },
            {
              title: "3. Simpan & kirim",
              desc: "Hasil disimpan ke Postgres lalu langsung dikirim ke frontend.",
            },
          ].map((item) => (
            <Card key={item.title} className="border-white/10 bg-white/10 text-white">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="text-white/75">{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
