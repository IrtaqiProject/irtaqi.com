"use client";

import { atom, useAtom } from "jotai";
import { Loader2, PlayCircle, Wand2, Rocket } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function TranscribePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const youtubeAtom = useMemo(() => atom(""), []);
  const promptAtom = useMemo(() => atom("Highlight ayat, hadits, dan poin praktis."), []);
  const loadingAtom = useMemo(() => atom(false), []);
  const resultAtom = useMemo(() => atom(null), []);
  const errorAtom = useMemo(() => atom(""), []);
  const [youtubeUrl, setYoutubeUrl] = useAtom(youtubeAtom);
  const [prompt, setPrompt] = useAtom(promptAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [result, setResult] = useAtom(resultAtom);
  const [error, setError] = useAtom(errorAtom);

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
    setResult(null);
    try {
      const res = await fetch("/api/queue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to enqueue");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enqueue");
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
          <p className="text-sm font-semibold text-emerald-200">Transcribe kajian</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Masukkan URL YouTube untuk diproses</h1>
          <p className="text-white/75">
            Audio diekstrak, dikirim ke antrean BullMQ, lalu diproses WhisperAPI (atau fallback stub).
          </p>
        </div>

        <Card className="border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur">
        <CardHeader>
          <CardTitle>Form transkripsi</CardTitle>
          <CardDescription className="text-white/80">
            URL YouTube akan dipangkas ke videoId sebelum dikirim ke antrean.
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
              Kirim ke antrean
            </Button>
          </form>
          {result ? (
            <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 p-4 text-sm shadow-inner">
              <p className="font-semibold text-emerald-200">Job dikirim</p>
              <p className="text-white/80">ID: {result.jobId}</p>
              <p className="text-white/60">State: {result.state}</p>
              <p className="text-white/60 text-xs mt-2">
                Worker akan mengeksekusi transkripsi. Pastikan worker & Redis berjalan.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "1. Entri", desc: "Masukkan URL kajian, prompt opsional." },
          { title: "2. Antrean", desc: "BullMQ menunggu worker untuk memproses." },
          {
            title: "3. Transkripsi",
            desc: "Worker memanggil WhisperAPI (atau fallback) dan simpan hasilnya.",
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
