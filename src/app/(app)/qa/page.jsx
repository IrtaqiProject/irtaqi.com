"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepLayout } from "@/components/step-layout";
import { streamFeature } from "@/lib/feature-stream-client";
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
  const [streamingText, setStreamingText] = useState("");

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
    setStreamingText("");
    setError("");
    try {
      const data = await streamFeature(
        "qa",
        {
          transcript: transcriptResult.transcript,
          prompt,
          youtubeUrl: transcriptResult.youtubeUrl,
          videoId: transcriptResult.videoId,
          transcriptId: transcriptResult.id,
          durationSeconds: transcriptResult.durationSeconds ?? null,
        },
        {
          onToken: (token) =>
            setStreamingText((prev) => (prev ? `${prev}${token}` : token)),
        },
      );
      setQaResult({ sample_questions: data.qa?.sample_questions ?? [], model: data.model });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat Q&A");
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  };

  const durationSeconds = transcriptResult?.durationSeconds;
  const metaText = durationSeconds ? `${Math.round(durationSeconds / 60)} menit` : "?";

  return (
    <StepLayout
      activeKey="qa"
      title="Ingin gali materi lebih dalam? Gunakan Prompt Q&A kapan saja"
      subtitle='Biarkan sistem menjawab pertanyaan Anda secara langsung dan terarah.'
    >
      {!transcriptReady ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Transcript belum tersedia</CardTitle>
            <CardDescription className="text-white/75">
              Proses &amp; simpan URL di langkah transcribe terlebih dahulu, lalu kembali ke sini.
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
      ) : (
        <>
          <Card className="border-white/10 bg-[#1a1a3a]/80 text-white shadow-2xl backdrop-blur">
            <CardHeader>
              <CardTitle>Tanya &amp; jawab</CardTitle>
              <CardDescription className="text-white/75">
                Susun pertanyaan untuk belajar cepat atau membuat kuis kajian. Transcript:{" "}
                {transcriptResult.videoId ?? "tidak dikenal"} · Durasi {metaText}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt Q&amp;A</span>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Susun 5-10 tanya jawab yang merujuk pada dalil dan amalan."
                />
              </label>
              {error ? <p className="text-sm text-amber-300">{error}</p> : null}
              {(loading || streamingText) && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Streaming token</p>
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
                  "w-full bg-gradient-to-r from-[#8b5cf6] via-[#7b71f3] to-[#4f46e5] text-white shadow-[0_10px_30px_rgba(124,92,255,0.45)]",
                )}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                Buat Q&amp;A
              </Button>
            </CardContent>
          </Card>

          {questions.length ? (
            <Card className="border-white/10 bg-white/5 text-white">
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
        </>
      )}
    </StepLayout>
  );
}
