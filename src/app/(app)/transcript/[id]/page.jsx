"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  transcriptDetailAtom,
  transcriptDetailErrorAtom,
  transcriptDetailLoadingAtom,
} from "@/state/ui-atoms";

const stageClasses = {
  done: "border-emerald-300/40 bg-emerald-300/15 text-emerald-100",
  todo: "border-white/15 bg-white/5 text-white/70",
};

function StageBadge({ label, state = "todo" }) {
  const icon =
    state === "done" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${stageClasses[state] ?? stageClasses.todo}`}
    >
      {icon}
      {label}
    </span>
  );
}

function formatRelativeTime(value) {
  if (!value) return "Waktu tidak diketahui";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak diketahui";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return date.toLocaleDateString("id-ID");
}

function formatDurationShort(seconds) {
  if (
    typeof seconds !== "number" ||
    Number.isNaN(seconds) ||
    seconds <= 0
  ) {
    return "Durasi belum diketahui";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}j ${restMinutes}m` : `${hours}j`;
}

function parseVideoIdFromUrl(input) {
  if (!input) return null;
  const urlIdMatch = input.match(/[?&]v=([^&#]+)/)?.[1];
  const shortMatch = input.match(/youtu\.be\/([^?]+)/)?.[1];
  const embedMatch = input.match(/youtube\.com\/embed\/([^?]+)/)?.[1];
  const plainIdMatch = input.match(/^[a-zA-Z0-9_-]{11}$/)?.[0];
  return (
    urlIdMatch ?? shortMatch ?? embedMatch ?? plainIdMatch ?? null
  );
}

function normalizeTranscript(item) {
  if (!item) return null;
  const durationSeconds =
    typeof item.duration_seconds === "number"
      ? item.duration_seconds
      : typeof item.durationSeconds === "number"
        ? item.durationSeconds
        : null;
  return {
    id: item.id ?? null,
    videoId: item.video_id ?? item.videoId ?? null,
    youtubeUrl: item.youtube_url ?? item.youtubeUrl ?? null,
    durationSeconds,
    summary: item.summary ?? null,
    qa: item.qa ?? null,
    mindmap: item.mindmap ?? null,
    quiz: item.quiz ?? null,
    model: item.model ?? null,
    createdAt: item.created_at ?? item.createdAt ?? null,
    transcript: item.transcript ?? item.transcriptText ?? null,
    srt: item.srt ?? null,
    prompt: item.prompt ?? "",
    userId: item.user_id ?? item.userId ?? null,
  };
}

function quizQuestionCount(quiz) {
  if (!quiz) return null;
  const metaCount = Number(quiz?.meta?.total_questions);
  if (Number.isFinite(metaCount) && !Number.isNaN(metaCount)) {
    return metaCount;
  }
  const questions = Array.isArray(quiz?.questions)
    ? quiz.questions.length
    : null;
  return questions ?? null;
}

function excerpt(text, max = 600) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function SummarySection({ summary }) {
  const bulletPoints = summary?.bullet_points ?? [];
  return (
    <Card id="summary" className="border-white/10 bg-white/5 text-white">
      <CardHeader>
        <CardTitle>Ringkasan</CardTitle>
        <CardDescription className="text-white/70">
          Versi singkat dan detail hasil generate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-lg font-semibold text-white">
          {summary?.short ?? "Ringkasan singkat belum tersedia."}
        </p>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            Bullet points
          </p>
          {bulletPoints.length ? (
            <ul className="list-inside list-disc space-y-1 text-sm text-white/80">
              {bulletPoints.map((point) => (
                <li key={point.slice(0, 40)}>{point}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/60">
              Belum ada bullet points.
            </p>
          )}
        </div>
        {summary?.detailed ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              Ringkasan detail
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {summary.detailed}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QaSection({ qa }) {
  const questions = qa?.sample_questions ?? [];
  return (
    <Card id="qa" className="border-white/10 bg-white/5 text-white">
      <CardHeader>
        <CardTitle>Q&A</CardTitle>
        <CardDescription className="text-white/70">
          Pertanyaan–jawaban yang diambil dari transcript.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.length ? (
          questions.map((item, idx) => (
            <div
              key={`${item.question}-${idx}`}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="text-sm font-semibold text-white">
                {item.question}
              </p>
              <p className="text-xs text-white/70">{item.answer}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/70">
            Q&A belum tersedia untuk transcript ini.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MindmapSection({ mindmap }) {
  const outline = mindmap?.outline_markdown ?? mindmap?.outline ?? "";
  return (
    <Card id="mindmap" className="border-white/10 bg-white/5 text-white">
      <CardHeader>
        <CardTitle>Mindmap</CardTitle>
        <CardDescription className="text-white/70">
          Outline hierarkis (markdown) atau daftar node.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {outline ? (
          <pre className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/80">
            {outline}
          </pre>
        ) : null}
        {!outline && Array.isArray(mindmap?.nodes) ? (
          <p className="text-sm text-white/70">
            {mindmap.nodes.length} node siap dipakai.
          </p>
        ) : null}
        {!outline && !mindmap ? (
          <p className="text-sm text-white/70">
            Mindmap belum tersedia.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuizSection({ quiz }) {
  const questions = quiz?.questions ?? [];
  const count = quizQuestionCount(quiz);

  return (
    <Card id="quiz" className="border-white/10 bg-white/5 text-white">
      <CardHeader>
        <CardTitle>Quiz</CardTitle>
        <CardDescription className="text-white/70">
          Ringkasan soal yang sudah di-generate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              Total soal
            </p>
            <p className="text-lg font-semibold text-white">
              {count ?? "Belum ada"}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
            {quiz?.meta?.difficulty ?? "Default"}
          </span>
        </div>

        {questions.slice(0, 4).map((q, idx) => (
          <div
            key={q.question ?? idx}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Soal {idx + 1}
            </p>
            <p className="text-sm font-semibold text-white">
              {q.question}
            </p>
            {Array.isArray(q.options) ? (
              <ul className="mt-2 grid gap-1 text-xs text-white/70">
                {q.options.slice(0, 4).map((opt, optIdx) => (
                  <li
                    key={optIdx}
                    className="rounded-md bg-white/5 px-2 py-1"
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {!quiz ? (
          <p className="text-sm text-white/70">
            Quiz belum dibuat untuk transcript ini.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TranscriptDetailPage() {
  const params = useParams();
  const transcriptId = params?.id;
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useAtom(transcriptDetailAtom);
  const [loading, setLoading] = useAtom(transcriptDetailLoadingAtom);
  const [error, setError] = useAtom(transcriptDetailErrorAtom);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(
        `/login?callbackUrl=${encodeURIComponent(`/transcript/${transcriptId ?? ""}`)}`,
      );
    }
  }, [status, router, transcriptId]);

  useEffect(() => {
    if (status !== "authenticated" || !transcriptId) return;
    setData(null);
    setError("");
    setLoading(true);
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/transcripts/${transcriptId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Transcript tidak ditemukan.");
          }
          throw new Error(`Gagal memuat data (${res.status}).`);
        }
        const json = await res.json();
        if (!active) return;
        setData(normalizeTranscript(json.item));
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Tidak bisa mengambil transcript."
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [setData, setError, setLoading, status, transcriptId]);

  const urlLabel = data?.youtubeUrl
    ? data.youtubeUrl.replace(/^https?:\/\//, "")
    : "";
  let videoLabel = transcriptId ? `Transcript ${transcriptId}` : "Transcript";
  if (urlLabel) {
    videoLabel = urlLabel.length > 80 ? `${urlLabel.slice(0, 77)}...` : urlLabel;
  } else if (data?.videoId) {
    videoLabel = `YouTube ${data.videoId}`;
  }

  const durationText = formatDurationShort(data?.durationSeconds);
  const createdText = formatRelativeTime(data?.createdAt);
  const summaryDone = Boolean(data?.summary);
  const qaDone = Boolean(data?.qa);
  const mindmapDone = Boolean(data?.mindmap);
  const quizDone = Boolean(data?.quiz);
  const completionStages = [
    { state: "done" },
    { state: summaryDone ? "done" : "todo" },
    { state: qaDone ? "done" : "todo" },
    { state: mindmapDone ? "done" : "todo" },
    { state: quizDone ? "done" : "todo" },
  ];
  const doneCount = completionStages.filter((s) => s.state === "done").length;
  const completion = Math.round((doneCount / completionStages.length) * 100);

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0a0b1c] via-[#0f0d2d] to-[#0c1427] pb-20 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-[#7c5cff]/25 blur-3xl" />
        <div className="absolute right-[-12%] top-20 h-72 w-72 rounded-full bg-[#1fb1ff]/18 blur-3xl" />
        <div className="absolute bottom-[-16%] left-[25%] h-72 w-72 rounded-full bg-[#ff67d9]/16 blur-3xl" />
        <div className="absolute bottom-10 right-[20%] h-40 w-40 rounded-full bg-[#22d3ee]/12 blur-3xl" />
      </div>

      <div className="container relative space-y-8 py-12">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            className="bg-white/10 text-white hover:bg-white/20"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
          <div className="flex flex-wrap gap-2">
            <StageBadge
              label="Summary"
              state={summaryDone ? "done" : "todo"}
            />
            <StageBadge label="Q&A" state={qaDone ? "done" : "todo"} />
            <StageBadge
              label="Mindmap"
              state={mindmapDone ? "done" : "todo"}
            />
            <StageBadge label="Quiz" state={quizDone ? "done" : "todo"} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-200">
            <Sparkles className="h-4 w-4" />
            Detail transcript
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{videoLabel}</h1>
          <p className="text-white/70">
            Durasi {durationText} · Dibuat {createdText} · ID {transcriptId}
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/70" />
            <p className="mt-3 text-sm text-white/70">
              Memuat detail transcript...
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6 text-sm text-amber-50">
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <Card className="border-white/10 bg-white/5 text-white shadow-xl">
              <CardHeader>
                <CardTitle>Ikhtisar</CardTitle>
                <CardDescription className="text-white/70">
                  Metadata transcript dan status fitur.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <PlayCircle className="h-4 w-4 text-white/60" />
                      <span className="text-white/80">
                        {data.youtubeUrl ? (
                          <Link
                            href={data.youtubeUrl}
                            className="underline underline-offset-2"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {data.youtubeUrl}
                          </Link>
                        ) : (
                          "URL tidak tersedia"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">
                      Video ID:{" "}
                      {data.videoId ||
                        parseVideoIdFromUrl(data.youtubeUrl) ||
                        "-"}
                    </p>
                    <p className="text-sm text-white/60">
                      Prompt awal: {data.prompt || "Tidak ada prompt."}
                    </p>
                  </div>
                  <div className="mt-4">
                    <ProgressBar
                      value={completion}
                      label="Progres fitur"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                    Aksi cepat
                  </p>
                  <Button asChild className="w-full shadow-brand">
                    <Link href="/transcribe">
                      Buka transcribe
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full bg-white/10 text-white hover:bg-white/20"
                  >
                    <Link href="#summary">
                      Lihat ringkasan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full bg-white/10 text-white hover:bg-white/20"
                  >
                    <Link href="#quiz">
                      Lihat quiz
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-white/10 bg-white/5 text-white shadow-xl lg:col-span-2">
                <CardHeader>
                  <CardTitle>Transcript</CardTitle>
                  <CardDescription className="text-white/70">
                    Cuplikan isi transkripsi asli.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.transcript ? (
                    <pre className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-white/80">
                      {excerpt(data.transcript, 2200)}
                    </pre>
                  ) : (
                    <p className="text-sm text-white/70">
                      Transcript belum tersedia.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white shadow-xl">
                <CardHeader>
                  <CardTitle>Status fitur</CardTitle>
                  <CardDescription className="text-white/70">
                    Cek fitur mana yang sudah siap.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <BookOpen className="h-4 w-4 text-emerald-200" />
                    <span className="text-sm font-semibold text-white">
                      Summary
                    </span>
                    <StageBadge
                      label={summaryDone ? "Siap" : "Belum"}
                      state={summaryDone ? "done" : "todo"}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <FileText className="h-4 w-4 text-emerald-200" />
                    <span className="text-sm font-semibold text-white">
                      Q&A
                    </span>
                    <StageBadge
                      label={qaDone ? "Siap" : "Belum"}
                      state={qaDone ? "done" : "todo"}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <Sparkles className="h-4 w-4 text-emerald-200" />
                    <span className="text-sm font-semibold text-white">
                      Mindmap
                    </span>
                    <StageBadge
                      label={mindmapDone ? "Siap" : "Belum"}
                      state={mindmapDone ? "done" : "todo"}
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <PlayCircle className="h-4 w-4 text-emerald-200" />
                    <span className="text-sm font-semibold text-white">
                      Quiz
                    </span>
                    <StageBadge
                      label={quizDone ? "Siap" : "Belum"}
                      state={quizDone ? "done" : "todo"}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <SummarySection summary={data.summary} />
            <QaSection qa={data.qa} />
            <MindmapSection mindmap={data.mindmap} />
            <QuizSection quiz={data.quiz} />
          </>
        ) : null}
      </div>
    </main>
  );
}
