"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  MessageSquare,
  Sparkles,
  XCircle,
} from "lucide-react";

import { generateQuizAction } from "@/actions/transcription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepLayout } from "@/components/step-layout";
import { cn } from "@/lib/utils";
import {
  quizErrorAtom,
  quizLoadingAtom,
  quizPromptAtom,
  quizResultAtom,
  transcriptResultAtom,
} from "@/state/transcribe-atoms";
import {
  currentIndexAtom,
  revealedAtom,
  scoreAtom,
  selectionsAtom,
  showResultsAtom,
  validationAtom,
} from "@/state/quiz-atoms";

function normalizeQuestions(questions = []) {
  return (questions ?? []).map((item, idx) => {
    const rawOptions = Array.isArray(item?.options) ? item.options.filter(Boolean) : [];
    const options = rawOptions.slice(0, 4);
    while (options.length < 4) {
      options.push(`Pilihan ${String.fromCharCode(65 + options.length)}`);
    }
    let correctIndex =
      typeof item?.correct_option_index === "number" && options[item.correct_option_index] !== undefined
        ? item.correct_option_index
        : options.findIndex((opt) => opt?.trim() === item?.answer?.trim());
    if (correctIndex < 0 || Number.isNaN(correctIndex)) correctIndex = 0;

    return {
      ...item,
      id: item?.id ?? `q-${idx + 1}`,
      options,
      correct_option_index: correctIndex,
    };
  });
}

function buildOptionClassName({ isSelected, isRevealed, showAsCorrect, showAsWrong }) {
  const base =
    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition";
  const selectionClass = isSelected ? "border-emerald-200/70 bg-emerald-500/15" : "border-white/10 bg-white/5";

  let stateClass = "hover:border-white/20 hover:bg-white/10";
  if (isRevealed) {
    if (showAsCorrect) {
      stateClass = "border-emerald-300/80 bg-emerald-500/20";
    } else if (showAsWrong) {
      stateClass = "border-rose-300/70 bg-rose-500/15";
    } else {
      stateClass = "border-white/15";
    }
  }

  const penaltyClass = showAsWrong ? "opacity-90" : "";
  return cn(base, selectionClass, stateClass, penaltyClass);
}

function renderStatusIcon({ showAsCorrect, showAsWrong }) {
  if (showAsCorrect) {
    return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
  }
  if (showAsWrong) {
    return <XCircle className="h-5 w-5 text-rose-300" />;
  }
  return null;
}

export default function QuizPage() {
  const { status } = useSession();
  const router = useRouter();
  const [transcriptResult] = useAtom(transcriptResultAtom);
  const [quizResult, setQuizResult] = useAtom(quizResultAtom);
  const [prompt, setPrompt] = useAtom(quizPromptAtom);
  const [quizLoading, setQuizLoading] = useAtom(quizLoadingAtom);
  const [quizError, setQuizError] = useAtom(quizErrorAtom);
  const [currentIndex, setCurrentIndex] = useAtom(currentIndexAtom);
  const [selections, setSelections] = useAtom(selectionsAtom);
  const [revealed, setRevealed] = useAtom(revealedAtom);
  const [score, setScore] = useAtom(scoreAtom);
  const [showResults, setShowResults] = useAtom(showResultsAtom);
  const [validation, setValidation] = useAtom(validationAtom);

  const transcriptReady = Boolean(transcriptResult?.transcript);
  const normalizedQuestions = normalizeQuestions(quizResult?.questions ?? []);
  const totalQuestions = quizResult?.meta?.total_questions ?? normalizedQuestions.length;
  const answeredCount = Object.keys(selections).length;
  const progress = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const accuracy = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;
  const currentQuestion = normalizedQuestions[currentIndex] ?? null;
  const allAnswered =
    normalizedQuestions.length > 0 &&
    normalizedQuestions.every((_, idx) => selections[idx] !== undefined);
  const durationSeconds =
    quizResult?.durationSeconds ??
    quizResult?.meta?.duration_seconds ??
    transcriptResult?.durationSeconds ??
    null;
  const videoMinutes = durationSeconds ? Math.round(durationSeconds / 60) : null;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/quiz");
    }
  }, [status, router]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelections({});
    setRevealed({});
    setShowResults(false);
    setScore(0);
    setValidation("");
  }, [quizResult?.questions, setCurrentIndex, setSelections, setRevealed, setShowResults, setScore, setValidation]);

  useEffect(() => {
    if (!showResults) return;
    const total = normalizedQuestions.length;
    const alreadyRevealed = Object.keys(revealed).length;
    if (!total || alreadyRevealed === total) return;
    const allRevealed = normalizedQuestions.reduce((acc, _, idx) => ({ ...acc, [idx]: true }), {});
    setRevealed(allRevealed);
  }, [showResults, normalizedQuestions.length, revealed, setRevealed, normalizedQuestions]);

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

  const handleGenerateQuiz = async () => {
    if (!transcriptReady) {
      setQuizError("Proses transcript dulu di halaman transcribe.");
      return;
    }
    setQuizLoading(true);
    setQuizError("");
    setCurrentIndex(0);
    setSelections({});
    setRevealed({});
    setShowResults(false);
    setScore(0);
    setValidation("");
    try {
      const data = await generateQuizAction({
        transcript: transcriptResult.transcript,
        prompt,
        youtubeUrl: transcriptResult.youtubeUrl,
        videoId: transcriptResult.videoId,
        transcriptId: transcriptResult.id,
        durationSeconds: transcriptResult.durationSeconds ?? null,
      });
      const questions = data.quiz?.questions ?? [];
      const meta = data.quiz?.meta ?? {};
      setQuizResult({
        questions,
        meta,
        model: data.model,
        youtubeUrl: transcriptResult.youtubeUrl,
        videoId: transcriptResult.videoId,
        durationSeconds: data.durationSeconds ?? transcriptResult.durationSeconds ?? meta.duration_seconds ?? null,
      });
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Gagal membuat quiz");
    } finally {
      setQuizLoading(false);
    }
  };

  return (
    <StepLayout
      activeKey="quiz"
      title="Uji pemahaman dengan quiz pilihan ganda"
      subtitle='Siapkan prompt khusus untuk variasi soal.'
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-emerald-200">Quiz kajian</p>
              <h1 className="text-3xl font-bold sm:text-4xl">
                {quizResult?.videoId ?? transcriptResult.videoId ?? "Latihan soal dari transkrip YouTube"}
              </h1>
              <p className="text-white/75">
                {totalQuestions} soal pilihan ganda · Durasi video {videoMinutes ? `${videoMinutes} menit` : "?"} ·
                Sumber: {quizResult?.youtubeUrl ?? transcriptResult.youtubeUrl ?? "URL tidak tersedia"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="bg-white/15 text-white hover:bg-white/20" asChild>
                <Link href="/transcribe">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke transcribe
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-white/80 hover:bg-white/10"
                onClick={() => {
                  setSelections({});
                  setRevealed({});
                  setShowResults(false);
                  setScore(0);
                  setValidation("");
                  setCurrentIndex(0);
                }}
              >
                Reset jawaban
              </Button>
            </div>
          </div>

          <Card className="border-white/10 bg-white/5 text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Atur prompt quiz</CardTitle>
              <CardDescription className="text-white/75">
                Prompt ini hanya memengaruhi soal, tidak memengaruhi ringkasan atau mindmap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-white/80">Prompt quiz</span>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Minta variasi tingkat kesulitan atau fokus tema tertentu."
                />
              </label>
              {quizError ? <p className="text-sm text-amber-300">{quizError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={quizLoading}
                  onClick={handleGenerateQuiz}
                  className={cn(
                    "bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white shadow-brand",
                  )}
                >
                  {quizLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Jalankan Quiz
                </Button>
                {quizResult?.model ? <span className="text-sm text-white/70">Model: {quizResult.model}</span> : null}
              </div>
            </CardContent>
          </Card>

          {!normalizedQuestions.length ? (
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Belum ada quiz</CardTitle>
                <CardDescription className="text-white/75">
                  Tekan &quot;Bangun soal&quot; setelah transcript tersedia untuk mulai membuat quiz.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
              <Card className="border-white/10 bg-white/5 text-white shadow-2xl">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Soal {currentIndex + 1} dari {totalQuestions}
                    </p>
                    <CardTitle>{currentQuestion?.question ?? "Pertanyaan tidak ditemukan"}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Clock className="h-4 w-4" />
                    {videoMinutes ? `${videoMinutes} menit` : "Durasi tidak diketahui"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {currentQuestion?.options?.map((opt, idx) => {
                      const isSelected = selections[currentIndex] === idx;
                      const isRevealed = revealed[currentIndex];
                      const isCorrect = idx === currentQuestion.correct_option_index;
                      const showAsWrong = isRevealed && isSelected && !isCorrect;
                      const showAsCorrect = isRevealed && isCorrect;
                      return (
                        <button
                          key={`${currentQuestion.id}-${idx}`}
                          onClick={() => {
                            if (revealed[currentIndex] || showResults) return;
                            setValidation("");
                            setSelections((prev) => ({ ...prev, [currentIndex]: idx }));
                          }}
                          className={buildOptionClassName({ isSelected, isRevealed, showAsCorrect, showAsWrong })}
                          disabled={isRevealed || showResults}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="text-white/90">{opt}</span>
                          </span>
                          {renderStatusIcon({ showAsCorrect, showAsWrong })}
                        </button>
                      );
                    })}
                  </div>

                  {validation ? <p className="text-sm text-amber-200">{validation}</p> : null}

                  {revealed[currentIndex] ? (
                    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                      <p className="flex items-center gap-2 font-semibold text-white">
                        <MessageSquare className="h-4 w-4 text-emerald-300" /> Pembahasan
                      </p>
                      <p>{currentQuestion?.explanation ?? "Penjelasan belum tersedia."}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-semibold text-white">
                        {currentIndex + 1}
                      </span>
                      <span>
                        Jawaban dipilih:{" "}
                        {selections[currentIndex] !== undefined
                          ? String.fromCharCode(65 + selections[currentIndex])
                          : "Belum ada"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (currentQuestion == null) return;
                          if (selections[currentIndex] === undefined) {
                            setValidation("Pilih salah satu jawaban terlebih dahulu.");
                            return;
                          }
                          setValidation("");
                          setRevealed((prev) => ({ ...prev, [currentIndex]: true }));
                        }}
                        disabled={revealed[currentIndex] || showResults}
                        className="bg-white/15 text-white hover:bg-white/20"
                      >
                        Kunci jawaban
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setValidation("");
                          setCurrentIndex((idx) => Math.max(idx - 1, 0));
                        }}
                        disabled={currentIndex === 0}
                        className="text-white/75 hover:bg-white/10"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Sebelumnya
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setValidation("");
                          setCurrentIndex((idx) => Math.min(idx + 1, normalizedQuestions.length - 1));
                        }}
                        disabled={currentIndex === normalizedQuestions.length - 1}
                        className="bg-gradient-to-r from-[#8b5cf6] via-[#9b5cff] to-[#4f46e5] text-white"
                      >
                        Selanjutnya
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Progress kuis</CardTitle>
                    <CardDescription className="text-white/75">
                      {Object.keys(selections).length} dari {totalQuestions} soal sudah dipilih.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-500 transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-white/75">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/60">Total soal</p>
                        <p className="text-xl font-semibold text-white">{totalQuestions}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/60">Durasi video</p>
                        <p className="text-xl font-semibold text-white">{videoMinutes ? `${videoMinutes}m` : "?"}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!allAnswered}
                      onClick={() => {
                        const finalScore = normalizedQuestions.reduce((acc, q, idx) => {
                          const selected = selections[idx];
                          return acc + (selected === q.correct_option_index ? 1 : 0);
                        }, 0);
                        setScore(finalScore);
                        setShowResults(true);
                      }}
                      className="w-full bg-gradient-to-r from-[#16a34a] via-[#22c55e] to-[#10b981] text-white shadow-brand disabled:opacity-70"
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Selesai & lihat skor
                    </Button>
                    {!allAnswered ? <p className="text-xs text-amber-200">Jawab semua soal untuk melihat skor akhir.</p> : null}
                  </CardContent>
                </Card>

                {showResults ? (
                  <Card className="border-white/10 bg-emerald-600/15 text-white shadow-lg">
                    <CardHeader>
                      <CardTitle>Hasil akhir</CardTitle>
                      <CardDescription className="text-white/80">
                        Anda menjawab {score} / {totalQuestions} soal dengan benar.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white/80">
                        <p className="font-semibold text-emerald-200">{accuracy}% akurasi</p>
                        <p>
                          Pertajam pemahaman dengan mengulang soal yang salah atau kembali ke ringkasan untuk membaca ulang konteks.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild className="bg-white text-[#120b34]">
                          <Link href="/summary">Buka ringkasan</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-white/80 hover:bg-white/10"
                          onClick={() => {
                            setSelections({});
                            setRevealed({});
                            setShowResults(false);
                            setScore(0);
                            setValidation("");
                            setCurrentIndex(0);
                          }}
                        >
                          Coba ulang kuis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-white/10 bg-white/5 text-white">
                    <CardHeader>
                      <CardTitle>Tips mengerjakan</CardTitle>
                      <CardDescription className="text-white/75">
                        Kunci jawaban per soal untuk melihat pembahasan. Nilai akhir muncul setelah semua soal terjawab.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-white/80">
                      <p>• Soal dibuat otomatis dari transkrip video.</p>
                      <p>• Pilih jawaban, kunci, lalu lanjut ke soal berikutnya.</p>
                      <p>• Tekan &quot;Selesai&quot; setelah semua jawaban terisi.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </StepLayout>
  );
}
