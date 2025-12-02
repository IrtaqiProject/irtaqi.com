"use client";

import Link from "next/link";
import { useAtom } from "jotai";
import {
  GitBranch,
  Loader2,
  MessageSquare,
  PlayCircle,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { processYoutubeTranscriptionAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  mindmapChartAtom,
  mindmapRenderErrorAtom,
  mindmapResultAtom,
  qaResultAtom,
  summaryResultAtom,
  transcriptAtom,
  transcriptErrorAtom,
  transcriptLoadingAtom,
  youtubeAtom,
} from "@/state/transcribe-atoms";

export default function TranscribePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [youtubeUrl, setYoutubeUrl] = useAtom(youtubeAtom);
  const [transcript, setTranscript] = useAtom(transcriptAtom);
  const [loading, setLoading] = useAtom(transcriptLoadingAtom);
  const [error, setError] = useAtom(transcriptErrorAtom);
  const [, setSummaryResult] = useAtom(summaryResultAtom);
  const [, setQaResult] = useAtom(qaResultAtom);
  const [, setMindmapResult] = useAtom(mindmapResultAtom);
  const [, setMindmapChart] = useAtom(mindmapChartAtom);
  const [, setMindmapRenderError] = useAtom(mindmapRenderErrorAtom);

  const transcriptPreview =
    transcript?.transcript?.slice(0, 1200) ?? "";
  const srtPreview = transcript?.srt?.slice(0, 400) ?? "";
  const featureLinks = [
    {
      href: "/summarize",
      title: "Summarize",
      desc: "Prompt terpisah, jalankan ringkasan hanya saat diperlukan.",
      icon: Sparkles,
    },
    {
      href: "/qa",
      title: "Q&A",
      desc: "Bangun daftar tanya jawab praktis dari transcript.",
      icon: MessageSquare,
    },
    {
      href: "/mindmap",
      title: "Mindmap",
      desc: "Render peta pikiran dari node yang dihasilkan LLM.",
      icon: GitBranch,
    },
  ];

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

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTranscript(null);
    setSummaryResult(null);
    setQaResult(null);
    setMindmapResult(null);
    setMindmapChart("");
    setMindmapRenderError("");

    try {
      const data = await processYoutubeTranscriptionAction({
        youtubeUrl,
      });
      setTranscript(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses transcript"
      );
    } finally {
      setLoading(false);
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
          <p className="text-sm font-semibold text-emerald-200">
            Langkah 1 · Transcribe
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Ubah video kajian youtube kamu jadi teks siap pakai hanya
            dengan satu klik!
          </h1>
          <p className="text-white/75">
            Klik Transcribe dan biarkan sistem mengubah pembicaraan
            panjang menjadi teks bersih yang mudah dibaca. Praktis,
            cepat, dan akurat.
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Form transkripsi</CardTitle>
            <CardDescription className="text-white/80">
              Masukkan URL, ambil transcript/SRT, simpan ke Postgres,
              lalu gunakan hasilnya di halaman fitur lain tanpa
              re-fetch.
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
                Proses & simpan
              </Button>
            </form>

            {transcript ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 text-sm shadow-inner">
                  <p className="font-semibold text-emerald-200">
                    Transcript siap dipakai
                  </p>
                  <p className="text-white/80">
                    Disimpan dengan ID{" "}
                    <span className="font-mono">
                      {transcript.id ?? "–"}
                    </span>
                    . Model: {transcript.model ?? "stub"}.
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Video {transcript.videoId}{" "}
                    {transcript.lang
                      ? `(${transcript.lang.toUpperCase()})`
                      : ""}{" "}
                    · {transcript.youtubeUrl}
                  </p>
                  <p className="mt-2 text-xs text-white/70">
                    Gunakan hasil ini di halaman Summarize, Q&amp;A,
                    atau Mindmap. Setiap fitur punya prompt sendiri
                    dan hanya berjalan saat tombolnya diklik.
                  </p>
                </div>

                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Transcript &amp; SRT</CardTitle>
                    <CardDescription className="text-white/75">
                      Disimpan penuh di server, berikut cuplikan untuk
                      verifikasi.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                        Transcript
                      </p>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/80">
                        {transcriptPreview || "Belum ada transcript."}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                        SRT
                      </p>
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

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Pilih fitur setelah transcript siap</CardTitle>
            <CardDescription className="text-white/75">
              Prompt masing-masing ada di halaman berikut dan hanya
              dijalankan ketika tombolnya ditekan.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {featureLinks.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.href}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="rounded-full bg-white/10 p-2">
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    {item.title}
                  </div>
                  <p className="text-sm text-white/70">{item.desc}</p>
                  <Button
                    asChild
                    variant="outline"
                    className="justify-center bg-white/10 text-white hover:bg-white/20"
                  >
                    <Link href={item.href}>
                      Buka halaman {item.title}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1. Proses transcript",
              desc: "Ambil transcript + SRT dan simpan sekali.",
            },
            {
              title: "2. Fitur terpisah",
              desc: "Ringkasan, Q&A, dan mindmap dipicu manual di halaman masing-masing.",
            },
            {
              title: "3. Simpan & revisi",
              desc: "Gunakan prompt unik tiap fitur untuk mendapatkan output sesuai kebutuhan.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="border-white/10 bg-white/10 text-white"
            >
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="text-white/75">
                  {item.desc}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
