"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { FileText, GitBranch, Loader2, MessageCircle, PlayCircle, Rocket, Sparkles, ListChecks } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { processYoutubeTranscriptionAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  errorAtom,
  loadingAtom,
  mindmapChartAtom,
  mindmapErrorAtom,
  mindmapLoadingAtom,
  mindmapResultAtom,
  qaErrorAtom,
  qaLoadingAtom,
  qaResultAtom,
  quizErrorAtom,
  quizLoadingAtom,
  quizResultAtom,
  summaryErrorAtom,
  summaryLoadingAtom,
  summaryResultAtom,
  transcriptResultAtom,
  youtubeAtom,
} from "@/state/transcribe-atoms";

export default function TranscribePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [youtubeUrl, setYoutubeUrl] = useAtom(youtubeAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [result, setResult] = useAtom(transcriptResultAtom);
  const [error, setError] = useAtom(errorAtom);
  const [, setSummaryResult] = useAtom(summaryResultAtom);
  const [, setQaResult] = useAtom(qaResultAtom);
  const [, setMindmapResult] = useAtom(mindmapResultAtom);
  const [, setQuizResult] = useAtom(quizResultAtom);
  const [, setMindmapChart] = useAtom(mindmapChartAtom);
  const [, setMindmapError] = useAtom(mindmapErrorAtom);
  const [, setMindmapLoading] = useAtom(mindmapLoadingAtom);
  const [, setSummaryError] = useAtom(summaryErrorAtom);
  const [, setQaError] = useAtom(qaErrorAtom);
  const [, setQuizError] = useAtom(quizErrorAtom);
  const [, setSummaryLoading] = useAtom(summaryLoadingAtom);
  const [, setQaLoading] = useAtom(qaLoadingAtom);
  const [, setQuizLoading] = useAtom(quizLoadingAtom);

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

  const resetFeatureStates = () => {
    setSummaryResult(null);
    setSummaryError("");
    setSummaryLoading(false);
    setQaResult(null);
    setQaError("");
    setQaLoading(false);
    setMindmapResult(null);
    setMindmapError("");
    setMindmapChart("");
    setMindmapLoading(false);
    setQuizResult(null);
    setQuizError("");
    setQuizLoading(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    resetFeatureStates();
    try {
      const data = await processYoutubeTranscriptionAction({ youtubeUrl });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses transcript");
    } finally {
      setLoading(false);
    }
  };

  const transcriptText = result?.transcript ?? "";
  const srtText = result?.srt ?? "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#7a5bff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-0 h-80 w-80 rounded-full bg-[#4a9dff]/20 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-80 w-80 rounded-full bg-[#ff67d9]/18 blur-3xl" />
      </div>

      <div className="container relative max-w-5xl space-y-8 py-14 text-white">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold text-emerald-200">Transcribe kajian</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Masukkan URL YouTube untuk diubah jadi transcript</h1>
          <p className="text-white/75">
            Tekan &quot;Proses &amp; simpan&quot; untuk mengambil transcript penuh. Ringkasan, Q&amp;A, mindmap, dan quiz
            kini ada di halaman khusus dengan prompt terpisah.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Form transkripsi</CardTitle>
            <CardDescription className="text-white/80">
              URL dipangkas ke videoId, transcript diambil, lalu disimpan. Fitur lain dijalankan dari halaman masing-masing.
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
                  <p className="font-semibold text-emerald-200">Transcript siap dipakai</p>
                  <p className="text-white/80">
                    Disimpan dengan ID <span className="font-mono">{result.id ?? "–"}</span>. Video{" "}
                    {result.videoId} {result.lang ? `(${result.lang.toUpperCase()})` : ""}.
                  </p>
                  <p className="mt-2 text-xs text-white/60">{result.youtubeUrl}</p>
                </div>

                <Card className="border-white/10 bg-white/10 text-white shadow-lg">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Gunakan fitur lanjutan</CardTitle>
                      <CardDescription className="text-white/75">
                        Setiap fitur punya prompt sendiri dan baru berjalan saat tombolnya ditekan.
                      </CardDescription>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Button asChild size="sm" className="bg-white text-[#120b34]">
                        <Link href="/summary">
                          <Sparkles className="mr-2 h-4 w-4" />
                          Ringkas
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
                        <Link href="/qa">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Q&amp;A
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/20">
                        <Link href="/mindmap">
                          <GitBranch className="mr-2 h-4 w-4" />
                          Mindmap
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white">
                        <Link href="/quiz">
                          <ListChecks className="mr-2 h-4 w-4" />
                          Quiz
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Transcript &amp; SRT penuh</CardTitle>
                    <CardDescription className="text-white/75">
                      Konten lengkap ditampilkan tanpa pemotongan agar mudah dicek dan disalin.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                        <FileText className="h-4 w-4" /> Transcript
                      </p>
                      <pre className="mt-2 max-h-[450px] overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-white/80">
                        {transcriptText || "Belum ada transcript."}
                      </pre>
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                        <FileText className="h-4 w-4" /> SRT
                      </p>
                      <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-white/70">
                        {srtText || "Belum ada SRT."}
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
            { title: "1. Kirim URL", desc: "Server action menerima URL YouTube." },
            { title: "2. Ambil transcript", desc: "Transcript + SRT diambil penuh dan disimpan." },
            { title: "3. Jalankan fitur", desc: "Ringkas/Q&A/Mindmap/Quiz dipicu dari halaman khusus." },
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
