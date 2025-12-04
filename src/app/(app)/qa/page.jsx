"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { generateQaAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  qaErrorAtom,
  qaLoadingAtom,
  qaPromptAtom,
  qaResultAtom,
  transcriptResultAtom,
} from "@/state/transcribe-atoms";

export default function QaPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptResult] = useAtom(transcriptResultAtom);
  const [prompt, setPrompt] = useAtom(qaPromptAtom);
  const [qaResult, setQaResult] = useAtom(qaResultAtom);
  const [loading, setLoading] = useAtom(qaLoadingAtom);
  const [error, setError] = useAtom(qaErrorAtom);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/qa");
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
  const questions = qaResult?.sample_questions ?? [];

  const handleGenerate = async () => {
    if (!transcriptReady) {
      setError("Proses transcript dulu di halaman transcribe.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await generateQaAction({
        transcript: transcriptResult.transcript,
        prompt,
        youtubeUrl: transcriptResult.youtubeUrl,
        videoId: transcriptResult.videoId,
        durationSeconds: transcriptResult.durationSeconds ?? null,
      });
      setQaResult({ sample_questions: data.qa?.sample_questions ?? [], model: data.model });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat Q&A");
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
              Buka halaman transcribe, proses &amp; simpan URL YouTube, lalu kembali ke sini untuk membuat Q&amp;A.
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
          <p className="text-sm font-semibold text-emerald-200">Q&amp;A cepat</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Prompt khusus untuk pertanyaan &amp; jawaban</h1>
          <p className="text-white/75">
            Trigger manual hanya ketika dibutuhkan. Prompt ini tidak memengaruhi ringkasan, mindmap, atau quiz.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Atur prompt Q&amp;A</CardTitle>
            <CardDescription className="text-white/75">
              Transcript: {transcriptResult.videoId ?? "tidak dikenal"} · Durasi{" "}
              {transcriptResult.durationSeconds ? `${Math.round(transcriptResult.durationSeconds / 60)} menit` : "?"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="text-white/80">Prompt Q&amp;A</span>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:outline-none"
                placeholder="Minta daftar pertanyaan yang ingin dijawab jamaah."
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
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Jalankan Q&amp;A
            </Button>
          </CardContent>
        </Card>

        {questions.length ? (
          <Card className="border-white/10 bg-white/10 text-white">
            <CardHeader>
              <CardTitle>Daftar pertanyaan</CardTitle>
              <CardDescription className="text-white/75">
                Model: {qaResult?.model ?? "tidak diketahui"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((item, idx) => (
                <div key={`${item.question}-${idx}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-semibold text-white">Q: {item.question}</p>
                  <p className="text-white/75">A: {item.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
