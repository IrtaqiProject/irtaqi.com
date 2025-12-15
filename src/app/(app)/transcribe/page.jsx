"use client";

import { Suspense, useEffect } from "react";
import { useAtom } from "jotai";
import Link from "next/link";
import { FileText, Loader2, PlayCircle, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { processYoutubeTranscriptionAction } from "@/actions/transcription";
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
import { useFeatureProgress } from "@/lib/use-progress";
import { cn } from "@/lib/utils";
import { accountAtom } from "@/state/account-atoms";
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
  mindmapProgressAtom,
  quizProgressAtom,
  summaryProgressAtom,
  transcribeProgressAtom,
  qaProgressAtom,
} from "@/state/transcribe-atoms";

function extractVideoIdFromUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const urlIdMatch = trimmed.match(/[?&]v=([^&#]+)/)?.[1];
  const shortMatch = trimmed.match(/youtu\.be\/([^?]+)/)?.[1];
  const embedMatch = trimmed.match(
    /youtube\.com\/embed\/([^?]+)/
  )?.[1];
  const plainIdMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/)?.[0];
  return (
    urlIdMatch ?? shortMatch ?? embedMatch ?? plainIdMatch ?? null
  );
}

function TranscribePageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [youtubeUrl, setYoutubeUrl] = useAtom(youtubeAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [result, setResult] = useAtom(transcriptResultAtom);
  const [error, setError] = useAtom(errorAtom);
  const [transcribeProgress, setTranscribeProgress] = useAtom(
    transcribeProgressAtom
  );
  const [, setAccount] = useAtom(accountAtom);
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
  const [, setSummaryProgress] = useAtom(summaryProgressAtom);
  const [, setQaProgress] = useAtom(qaProgressAtom);
  const [, setMindmapProgress] = useAtom(mindmapProgressAtom);
  const [, setQuizProgress] = useAtom(quizProgressAtom);
  const transcribeProgressCtrl = useFeatureProgress(
    setTranscribeProgress
  );

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

  const resetFeatureStates = () => {
    setSummaryResult(null);
    setSummaryError("");
    setSummaryLoading(false);
    setSummaryProgress(0);
    setQaResult(null);
    setQaError("");
    setQaLoading(false);
    setQaProgress(0);
    setMindmapResult(null);
    setMindmapError("");
    setMindmapChart("");
    setMindmapLoading(false);
    setMindmapProgress(0);
    setQuizResult(null);
    setQuizError("");
    setQuizLoading(false);
    setQuizProgress(0);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    resetFeatureStates();
    transcribeProgressCtrl.start();
    try {
      const data = await processYoutubeTranscriptionAction({
        youtubeUrl,
      });
      setResult(data);
      if (data?.account) setAccount(data.account);
      transcribeProgressCtrl.complete();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses transcript"
      );
      transcribeProgressCtrl.fail();
    } finally {
      setLoading(false);
    }
  };

  const transcriptText = result?.transcript ?? "";
  const srtText = result?.srt ?? "";
  const derivedVideoId = extractVideoIdFromUrl(youtubeUrl);
  const activeVideoId = derivedVideoId ?? result?.videoId ?? null;
  const embedUrl = activeVideoId
    ? `https://www.youtube.com/embed/${activeVideoId}`
    : null;
  const previewUrlText = youtubeUrl || result?.youtubeUrl || "";

  return (
    <StepLayout
      activeKey="transcribe"
      title="Ubah Video Youtubemu yang panjang jadi teks hanya dengan satu klik!"
      subtitle="Cukup klik Transcribe dan biarkan kami menuliskannya untuk Anda. Mudah, cepat, dan bikin hidup lebih simpel."
    >
      <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
        <CardHeader>
          <CardTitle>Transcribe video</CardTitle>
          <CardDescription className="text-white/80">
            Masukkan URL YouTube lalu tekan &quot;Buat
            Transcribe&quot;. Transcript dan SRT lengkap akan
            tersimpan dan siap dipakai di langkah berikutnya.
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
            {error ? (
              <p className="text-sm text-amber-300">{error}</p>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand"
              )}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              Buat Transcribe
            </Button>
            {transcribeProgress > 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <ProgressBar
                  value={transcribeProgress}
                  label="Mentranskrip video"
                />
                <p className="mt-2 text-xs text-white/60">
                  Mengambil transcript YouTube dan menyiapkan SRT.
                </p>
              </div>
            ) : null}
          </form>

          {embedUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  Preview video
                </p>
                <p className="text-xs text-white/60">
                  {previewUrlText || "Masukkan URL YouTube"}
                </p>
              </div>
              <div className="aspect-video w-full bg-black/30">
                <iframe
                  key={activeVideoId}
                  src={`${embedUrl}?rel=0`}
                  title="Preview video YouTube"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 text-sm shadow-inner">
                <p className="font-semibold text-emerald-200">
                  Transcript siap dipakai
                </p>
                {/* <p className="text-white/80">
                  Disimpan dengan ID{" "}
                  <span className="font-mono">
                    {result.id ?? "–"}
                  </span>
                  . Video {result.videoId}
                  {result.lang
                    ? ` (${result.lang.toUpperCase()})`
                    : ""}
                  .
                </p> */}
                <p className="mt-2 text-xs text-white/60">
                  {result.youtubeUrl}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    asChild
                    className="bg-white text-[#120b34]"
                  >
                    <Link href="/summary">Lanjut ke Summarize</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    asChild
                    className="bg-white/15 text-white hover:bg-white/20"
                  >
                    <Link href="/qa">Langkah Q&amp;A</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    asChild
                    className="bg-white/15 text-white hover:bg-white/20"
                  >
                    <Link href="/mindmap">Langkah Mindmap</Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white"
                  >
                    <Link href="/quiz">Langkah Quiz</Link>
                  </Button>
                </div>
              </div>

              <Card className="border-white/10 bg-[#12122f]/70 text-white">
                <CardHeader>
                  <CardTitle>Transcript &amp; SRT penuh</CardTitle>
                  {/* <CardDescription className="text-white/75">
                    Konten lengkap ditampilkan tanpa pemotongan agar
                    mudah dicek dan disalin.
                  </CardDescription> */}
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
    </StepLayout>
  );
}

function TranscribeFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] text-white">
      <Loader2 className="h-6 w-6 animate-spin text-white/70" />
    </main>
  );
}

export default function TranscribePage() {
  return (
    <Suspense fallback={<TranscribeFallback />}>
      <TranscribePageContent />
    </Suspense>
  );
}
