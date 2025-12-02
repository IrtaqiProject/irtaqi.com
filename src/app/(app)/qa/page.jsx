"use client";

import Link from "next/link";
import { useAtom } from "jotai";
import { Loader2, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { generateQaAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  qaPromptAtom,
  qaResultAtom,
  transcriptAtom,
  youtubeAtom,
} from "@/state/transcribe-atoms";

const navLinks = [
  { href: "/transcribe", label: "Transcribe" },
  { href: "/summarize", label: "Summarize" },
  { href: "/qa", label: "Q&A" },
  { href: "/mindmap", label: "Mindmap" },
];

export default function QaPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useAtom(qaPromptAtom);
  const [qaResult, setQaResult] = useAtom(qaResultAtom);
  const [transcript] = useAtom(transcriptAtom);
  const [youtubeUrl] = useAtom(youtubeAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const transcriptPreview =
    transcript?.transcript?.slice(0, 600) ?? "";
  const questions = qaResult?.qa?.sample_questions ?? [];

  useEffect(() => {
    if (status === "unauthenticated") {
      const params = new URLSearchParams(searchParams);
      params.set("callbackUrl", "/qa");
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

  const handleQa = async (e) => {
    e.preventDefault();
    if (!transcript?.transcript) {
      setError(
        "Transkrip belum diproses. Jalankan dulu di halaman Transcribe."
      );
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await generateQaAction({
        transcript: transcript.transcript,
        prompt,
        videoTitle: transcript.youtubeUrl || youtubeUrl || "Kajian",
      });
      setQaResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat Q&A"
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
              variant={item.href === "/qa" ? "default" : "outline"}
              className={
                item.href === "/qa"
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
            Langkah 3 · Q&amp;A
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Ingin gali materi lebih dalam? Gunakan Prompt Q&A kapan
            saja
          </h1>
          <p className="text-white/75">
            biarkan sistem menjawab pertanyaan Anda secara langsung
            dan terarah
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Tanya &amp; jawab</CardTitle>
            <CardDescription className="text-white/80">
              Susun pertanyaan untuk belajar cepat atau membuat kuis
              kajian.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleQa}>
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt Q&amp;A</span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Buat pertanyaan yang menguji pemahaman dalil, istilah penting, dan amalan praktis..."
                />
              </label>
              {error ? (
                <p className="text-sm text-amber-300">{error}</p>
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
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Buat Q&amp;A
              </Button>
            </form>
          </CardContent>
        </Card>

        {questions.length ? (
          <Card className="border-white/10 bg-white/10 text-white">
            <CardHeader>
              <CardTitle>Daftar Q&amp;A</CardTitle>
              <CardDescription className="text-white/75">
                Tanya jawab tidak akan berjalan otomatis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((item, idx) => (
                <div
                  key={`${item.question}-${idx}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    Q: {item.question}
                  </p>
                  <p className="text-sm text-white/75">
                    A: {item.answer}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Transcript aktif</CardTitle>
            <CardDescription className="text-white/75">
              Gunakan transcript yang sudah disimpan supaya
              tanya-jawab relevan.
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
                <pre className="max-h-40 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/80">
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
