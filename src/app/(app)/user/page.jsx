"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAtom } from "jotai";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  Sparkles,
  User as UserIcon,
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
  accountAtom,
  accountErrorAtom,
  accountLoadingAtom,
} from "@/state/account-atoms";
import {
  userDataErrorAtom,
  userDataLoadingAtom,
  userTranscriptsAtom,
} from "@/state/ui-atoms";

const DEFAULT_AVATAR = "/avatar-default.svg";

const stageClasses = {
  completed:
    "border-emerald-400/60 bg-emerald-400/10 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.25)]",
  done: "border-emerald-400/60 bg-emerald-400/10 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.25)]",
  "in-progress":
    "border-sky-400/60 bg-sky-400/10 text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.22)]",
  pending: "border-white/20 bg-white/5 text-white/70",
  todo: "border-white/20 bg-white/5 text-white/70",
};

const PLAN_CHOICES = [
  {
    id: "plus",
    label: "Plus",
    perks: ["Akses semua fitur", "Prioritas reguler"],
    price: "Mulai belajar serius",
  },
  {
    id: "pro",
    label: "Pro",
    perks: ["Prioritas cepat", "Support prioritas"],
    price: "Untuk pengguna aktif",
  },
  {
    id: "ultra",
    label: "Ultra",
    perks: ["Prioritas tertinggi", "Pemakaian tanpa batas"],
    price: "Skala intensif",
  },
];

function StageBadge({ label, state = "pending" }) {
  let normalizedState = state;
  if (state === "done") normalizedState = "completed";
  else if (state === "todo") normalizedState = "pending";

  let icon = <Clock className="h-4 w-4" />;
  if (normalizedState === "completed") {
    icon = <CheckCircle2 className="h-4 w-4" />;
  } else if (normalizedState === "in-progress") {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${stageClasses[normalizedState] ?? stageClasses.pending}`}
    >
      {icon}
      {label}
    </span>
  );
}

function calculateCompletion(stages) {
  if (!Array.isArray(stages) || stages.length === 0) return 0;
  const doneStates = new Set(["done", "completed"]);
  const doneCount = stages.filter((stage) =>
    doneStates.has(stage.state)
  ).length;
  return Math.round((doneCount / stages.length) * 100);
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
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
    userId: item.user_id ?? item.userId ?? null,
  };
}

function buildStageStates(video) {
  return [
    { key: "transcript", label: "Transcript", state: "completed" },
    {
      key: "summary",
      label: "Ringkasan",
      state: video.summary ? "completed" : "pending",
    },
    {
      key: "qa",
      label: "Q&A",
      state: video.qa ? "completed" : "pending",
    },
    {
      key: "mindmap",
      label: "Mindmap",
      state: video.mindmap ? "completed" : "pending",
    },
    {
      key: "quiz",
      label: "Quiz",
      state: video.quiz ? "completed" : "pending",
    },
  ];
}

function isFullyProcessed(video) {
  if (!video) return false;
  return Boolean(video.summary && video.qa && video.mindmap && video.quiz);
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

function formatVideoLabel(video, index) {
  const urlLabel = video.youtubeUrl
    ? video.youtubeUrl.replace(/^https?:\/\//, "")
    : "";
  if (urlLabel) {
    return urlLabel.length > 60
      ? `${urlLabel.slice(0, 57)}...`
      : urlLabel;
  }
  if (video.videoId) return `YouTube ${video.videoId}`;
  return `Transkrip ${index + 1}`;
}

function resolveVideoId(video) {
  return (
    video?.videoId ||
    parseVideoIdFromUrl(video?.youtubeUrl || "") ||
    null
  );
}

function buildThumbnailUrl(video) {
  const id = resolveVideoId(video);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function derivePreferenceProfile({
  name,
  totalVideos,
  summaryReady,
  mindmapReady,
  quizReady,
  qaReady,
}) {
  const counts = {
    summary: summaryReady,
    qa: qaReady,
    mindmap: mindmapReady,
    quiz: quizReady,
  };
  const order = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topKey = order[0]?.[0] ?? "summary";
  const labels = {
    summary: "Ringkasan padat",
    qa: "Q&A mendalam",
    mindmap: "Mindmap visual",
    quiz: "Quiz & gamifikasi",
  };
  const focusCopyMap = {
    summary:
      "Kamu sering menyimpan ringkasan; kita utamakan menuntaskan summary sebelum fitur lain.",
    qa: "Kamu suka diskusi; kita dorong Q&A dan klarifikasi konsep penting.",
    mindmap:
      "Kamu nyaman dengan visual; mindmap kita jadikan prioritas belajar.",
    quiz: "Kamu rajin latihan soal; kita fokus menyiapkan quiz setiap video.",
  };

  const planText =
    totalVideos === 0
      ? "Mulai 1 video pekan ini untuk bangun ritme."
      : totalVideos < 3
        ? "Target 2-3 video pekan ini agar progres stabil."
        : "Pertahankan ritme 3-4 video per pekan.";

  const styleText =
    topKey === "summary"
      ? "Suka ringkasan bullet & highlight dalil."
      : topKey === "qa"
        ? "Suka tanya–jawab untuk menguji pemahaman."
        : topKey === "mindmap"
          ? "Suka visual dan mindmap hierarkis."
          : "Suka latihan soal dan gamifikasi belajar.";

  return {
    topKey,
    topLabel: labels[topKey],
    focusCopy: focusCopyMap[topKey],
    planText,
    styleText,
    personaLine: `${name}, kami sesuaikan rekomendasi dengan fokus "${labels[topKey]}".`,
  };
}

function buildLearningFocus({ transcripts, preferenceKey }) {
  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    return [
      {
        title: "Mulai video pertama",
        detail:
          "Tambah URL di Transcribe, lalu lanjutkan summary/quiz sesuai gaya belajarmu.",
      },
      {
        title: "Set target pekan ini",
        detail: "Minimal 1-2 video untuk membiasakan ritme.",
      },
      {
        title: "Siapkan prompt favorit",
        detail:
          "Tulis preferensi ringkasan/quiz agar hasil lebih personal.",
      },
    ];
  }

  const focus = [];
  const firstWithoutSummary = transcripts.find((t) => !t.summary);
  if (firstWithoutSummary) {
    focus.push({
      title: `Rangkum ${formatVideoLabel(firstWithoutSummary, 0)}`,
      detail:
        "Buka Summary dan generate ringkasan sesuai gaya yang kamu suka.",
    });
  }

  const firstWithoutQuiz = transcripts.find(
    (t) => t.summary && !t.quiz,
  );
  if (firstWithoutQuiz) {
    focus.push({
      title: `Buat quiz dari ${formatVideoLabel(firstWithoutQuiz, 0)}`,
      detail:
        "Gunakan hasil ringkasan untuk membuat soal cepat dan cek pemahaman.",
    });
  }

  const firstWithoutMindmap = transcripts.find(
    (t) => t.summary && !t.mindmap,
  );
  if (firstWithoutMindmap) {
    focus.push({
      title: `Visualisasikan ${formatVideoLabel(firstWithoutMindmap, 0)}`,
      detail:
        "Generate mindmap agar materi lebih mudah dihafal secara visual.",
    });
  }

  if (focus.length < 3) {
    focus.push({
      title:
        preferenceKey === "quiz"
          ? "Ulangi quiz favorit"
          : "Review hasil terbaru",
      detail:
        preferenceKey === "quiz"
          ? "Coba ulangi quiz yang sudah siap untuk menguatkan memori."
          : "Buka riwayat dan tandai bagian yang masih kurang jelas.",
    });
  }

  return focus.slice(0, 3);
}

function resolveAvatarUrl(image, email) {
  if (image) return image;
  if (email) {
    return `https://www.google.com/s2/avatar?email=${encodeURIComponent(email)}&sz=160`;
  }
  return DEFAULT_AVATAR;
}

function buildTimelineEntries(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 4).map((item, idx) => {
    const completion = calculateCompletion(buildStageStates(item));
    return {
      title: `${formatVideoLabel(item, idx)} · ${completion}%`,
      time: formatRelativeTime(item.createdAt),
      tone: isFullyProcessed(item) ? "good" : "neutral",
    };
  });
}

export default function UserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [transcripts, setTranscripts] = useAtom(userTranscriptsAtom);
  const [dataLoading, setDataLoading] = useAtom(userDataLoadingAtom);
  const [dataError, setDataError] = useAtom(userDataErrorAtom);
  const [account, setAccount] = useAtom(accountAtom);
  const [accountLoading, setAccountLoading] = useAtom(accountLoadingAtom);
  const [accountError, setAccountError] = useAtom(accountErrorAtom);
  const [plans, setPlans] = useState([]);
  const [subscribeLoading, setSubscribeLoading] = useState("");
  const [subscribeMessage, setSubscribeMessage] = useState("");

  useEffect(() => {
    setTranscripts([]);
    setDataError("");
    setDataLoading(true);
  }, [setDataError, setDataLoading, setTranscripts]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/user");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;

    const load = async () => {
      setDataLoading(true);
      setDataError("");
      try {
        const res = await fetch("/api/transcripts?limit=50");
        if (!res.ok) {
          throw new Error(`Gagal memuat data (${res.status}).`);
        }
        const json = await res.json();
        if (!active) return;
        const normalized = Array.isArray(json.items)
          ? json.items.map(normalizeTranscript).filter(Boolean)
          : [];
        setTranscripts(normalized);
      } catch (err) {
        if (!active) return;
        setDataError(
          err instanceof Error
            ? err.message
            : "Tidak bisa mengambil data transcript."
        );
      } finally {
        if (active) setDataLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (accountLoading || account) return;
    let active = true;

    const loadAccount = async () => {
      setAccountLoading(true);
      setAccountError("");
      try {
        const res = await fetch("/api/account", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          throw new Error(json?.error || "Gagal memuat akun.");
        }
        setAccount(json.account ?? null);
        setPlans(json.plans ?? []);
      } catch (err) {
        if (!active) return;
        setAccountError(
          err instanceof Error ? err.message : "Tidak bisa memuat akun."
        );
      } finally {
        if (active) setAccountLoading(false);
      }
    };

    loadAccount();
    return () => {
      active = false;
    };
  }, [
    status,
    account,
    accountLoading,
    setAccount,
    setAccountError,
    setAccountLoading,
  ]);

  const handleSubscribe = async (planId) => {
    setSubscribeLoading(planId);
    setSubscribeMessage("");
    setAccountError("");
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Gagal mengaktifkan langganan.");
      }
      setAccount(json.account ?? null);
      setPlans(json.plans ?? []);
      const activePlan = json.account?.subscriptionLabel || planId;
      setSubscribeMessage(`Langganan ${activePlan} aktif.`);
    } catch (err) {
      setAccountError(
        err instanceof Error ? err.message : "Gagal memproses langganan."
      );
    } finally {
      setSubscribeLoading("");
    }
  };

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

  const name = session?.user?.name ?? "Pengguna RingkasKajianAi.com";
  const email = session?.user?.email ?? "user@email.com";
  const userId = session?.user?.id ?? "demo-user";

  const totalVideos = transcripts.length;
  const completedVideos = transcripts.filter(isFullyProcessed).length;
  const inProgressVideos = transcripts.filter(
    (item) => !isFullyProcessed(item)
  ).length;
  const summaryReady = transcripts.filter((item) => item.summary).length;
  const mindmapReady = transcripts.filter((item) => item.mindmap).length;
  const quizReady = transcripts.filter((item) => item.quiz).length;
  const qaReady = transcripts.filter((item) => item.qa).length;
  const completionRate = percent(completedVideos, totalVideos);
  const quizRate = percent(quizReady, totalVideos);
  const planOptions = plans.length ? plans : PLAN_CHOICES;
  const tokenLabel = account?.isSubscribed
    ? `${account.subscriptionLabel ?? "Langganan aktif"} - Unlimited`
    : `${account?.tokens ?? 0}/${account?.maxTokens ?? 20} token`;
  const tokenShort = account?.isSubscribed
    ? account.subscriptionLabel ?? "Langganan"
    : `${account?.tokens ?? 0} token`;
  const preference = derivePreferenceProfile({
    name,
    totalVideos,
    summaryReady,
    mindmapReady,
    quizReady,
    qaReady,
  });
  const learningFocus = buildLearningFocus({
    transcripts,
    preferenceKey: preference.topKey,
  });

  const progressItems = [
    {
      label: "Video selesai sampai quiz",
      value: completionRate,
      detail: `${completedVideos}/${totalVideos || 0} video lengkap`,
    },
    {
      label: "Ringkasan siap",
      value: percent(summaryReady, totalVideos),
      detail: `${summaryReady} ringkasan tersedia`,
    },
    {
      label: "Mindmap siap",
      value: percent(mindmapReady, totalVideos),
      detail: `${mindmapReady} mindmap siap pakai`,
    },
    {
      label: "Quiz siap",
      value: quizRate,
      detail: quizReady ? `${quizReady} quiz siap` : "Belum ada quiz siap",
    },
  ];

  const timelineEntries = buildTimelineEntries(transcripts);
  const avatarUrl = resolveAvatarUrl(
    session?.user?.image,
    session?.user?.email,
  );
  const displayName = name || email || "Pengguna";
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "U";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0a0b1c] via-[#0f0d2d] to-[#0c1427] pb-20 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-[#7c5cff]/25 blur-3xl" />
        <div className="absolute right-[-12%] top-20 h-72 w-72 rounded-full bg-[#1fb1ff]/18 blur-3xl" />
        <div className="absolute bottom-[-16%] left-[25%] h-72 w-72 rounded-full bg-[#ff67d9]/16 blur-3xl" />
        <div className="absolute bottom-10 right-[20%] h-40 w-40 rounded-full bg-[#22d3ee]/12 blur-3xl" />
      </div>

      <div className="container relative space-y-8 py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Dashboard pengguna
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/10 shadow-lg">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="User avatar"
                    onError={(e) => {
                      if (e.currentTarget.src !== window.location.origin + DEFAULT_AVATAR) {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#8b5cf6]/40 to-[#22d3ee]/30 text-xl font-bold text-white">
                    {initials}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold sm:text-4xl">
                  Halo, {name}
                </h1>
                <p className="text-white/70">
                  Lihat data pribadi, video yang sudah ditranscribe,
                  dan progres belajar terbarumu.
                </p>
                <p className="text-white/70">
                  {preference.personaLine}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <UserIcon className="h-4 w-4 text-white/60" />
                {email}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                ID {userId}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="shadow-brand">
              <Link href="/transcribe">
                Transcribe baru
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="secondary"
              asChild
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/summary">Lanjutkan ringkasan</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-white/10 bg-white/5 text-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle>Token & paket</CardTitle>
              <CardDescription className="text-white/70">
                1 token untuk transcript, 2 token untuk Summary/QA/Mindmap/Quiz.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold">
                  {accountLoading ? "..." : tokenShort}
                </p>
                <p className="text-xs text-white/60">
                  {accountLoading ? "Memuat akun..." : tokenLabel}
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-amber-300" />
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 text-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle>Video ditranscribe</CardTitle>
              <CardDescription className="text-white/70">
                Total URL yang sudah diproses.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between gap-3">
              <p className="text-3xl font-bold">{totalVideos}</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {inProgressVideos} butuh kelanjutan
              </span>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 text-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle>Lengkap sampai quiz</CardTitle>
              <CardDescription className="text-white/70">
                Video yang tuntas semua fitur.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between gap-3">
              <p className="text-3xl font-bold">{completedVideos}</p>
              <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {completionRate}% tuntas
              </span>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5 text-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle>Quiz tersedia</CardTitle>
              <CardDescription className="text-white/70">
                Berdasar hasil generate terakhir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{quizReady}</p>
                <span className="text-xs text-white/60">
                  siap dari {totalVideos || 0}
                </span>
              </div>
              <BarChart3 className="h-6 w-6 text-emerald-200" />
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/5 text-white shadow-xl">
          <CardHeader>
            <CardTitle>Langganan & token</CardTitle>
            <CardDescription className="text-white/70">
              Free: 20 token. Transcript 1 token, fitur lain 2 token. Jika habis, upgrade ke Plus, Pro, atau Ultra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountError ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
                {accountError}
              </div>
            ) : null}
            {subscribeMessage ? (
              <div className="rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
                {subscribeMessage}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              {planOptions.map((plan) => {
                const isCurrent = account?.subscriptionTier === plan.id;
                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold text-white">
                        {plan.label}
                      </p>
                      {isCurrent ? (
                        <span className="rounded-full bg-emerald-300/20 px-2 py-1 text-xs font-semibold text-emerald-100">
                          Aktif
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/70">{plan.price}</p>
                    <ul className="mt-2 space-y-1 text-xs text-white/70">
                      {(plan.perks ?? []).map((perk) => (
                        <li key={perk}>• {perk}</li>
                      ))}
                    </ul>
                    <Button
                      className="mt-3 w-full bg-white/10 text-white hover:bg-white/20"
                      disabled={isCurrent || subscribeLoading === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {isCurrent
                        ? "Paket aktif"
                        : subscribeLoading === plan.id
                          ? "Memproses..."
                          : `Upgrade ke ${plan.label}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-white/5 text-white shadow-xl lg:col-span-2">
            <CardHeader>
              <CardTitle>Data pribadi</CardTitle>
              <CardDescription className="text-white/70">
                Disesuaikan otomatis dari akun yang dipakai login.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Nama lengkap", value: name },
                { label: "Email", value: email },
                { label: "ID pengguna", value: userId },
                {
                  label: "Rencana belajar",
                  value: preference.planText,
                },
                {
                  label: "Gaya ringkasan",
                  value: preference.styleText,
                },
                {
                  label: "Fokus unggulan",
                  value: preference.topLabel,
                },
                {
                  label: "Waktu favorit",
                  value: "Pagi (05.00 - 07.00 WIB)",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white shadow-xl">
            <CardHeader>
              <CardTitle>Fokus belajar minggu ini</CardTitle>
              <CardDescription className="text-white/70">
                Disesuaikan dengan kebiasaanmu: {preference.focusCopy}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningFocus.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-white/60">
                    {item.detail}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-50">
                <p className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Saran cepat
                </p>
                <p className="mt-1 text-xs">
                  Mulai dari video singkat untuk memanaskan otak sebelum
                  lanjut ke materi berat.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-white/10 bg-white/5 text-white shadow-xl lg:col-span-2">
                <CardHeader>
                  <CardTitle>
                    Video yang sudah ditranscribe & diproses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dataLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                      Memuat data proses video...
                </div>
              ) : null}

              {dataError ? (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
                  {dataError}
                </div>
              ) : null}

              {!dataLoading && !dataError && transcripts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                  <p className="text-lg font-semibold text-white">
                    Belum ada transcript tersimpan.
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Mulai proses YouTube di halaman transcribe untuk
                    melihat progres di sini.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Button asChild>
                      <Link href="/transcribe">Transcribe sekarang</Link>
                    </Button>
                  </div>
                </div>
              ) : null}

              {transcripts.map((video, idx) => {
                const stages = buildStageStates(video);
                const completion = calculateCompletion(stages);
                const quizCount = quizQuestionCount(video.quiz);
                const label = formatVideoLabel(video, idx);
                const createdLabel = formatRelativeTime(video.createdAt);
                const durationText = formatDurationShort(
                  video.durationSeconds
                );
                const quizStatusText = video.quiz
                  ? quizCount
                    ? `${quizCount} soal`
                    : "Sudah siap"
                  : "Belum dibuat";
                const quickId =
                  video.videoId ||
                  parseVideoIdFromUrl(video.youtubeUrl) ||
                  video.id;
                const detailHref = video.id ? `/transcript/${video.id}` : null;
                const thumbUrl = buildThumbnailUrl(video);
                const urlText = video.youtubeUrl || "URL tidak tersedia";
                const completionDone = completion >= 100;

                return (
                  <div
                    key={video.id || idx}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_14px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {stages.map((stage) => (
                          <StageBadge
                            key={stage.key}
                            label={stage.label}
                            state={stage.state}
                          />
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                        {completionDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                        )}
                        {completion}% selesai
                      </span>
                    </div>

                    {thumbUrl ? (
                      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
                        <div className="aspect-[16/9]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbUrl}
                            alt="YouTube thumbnail"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/50" />
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr,260px] md:items-start">
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-xl font-semibold text-white">
                              {label}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                              <span className="rounded-full bg-white/10 px-3 py-1">
                                Durasi {durationText}
                              </span>
                              {quickId ? (
                                <span className="rounded-full bg-white/10 px-3 py-1">
                                  ID {quickId}
                                </span>
                              ) : null}
                              <span className="rounded-full bg-white/10 px-3 py-1">
                                {createdLabel}
                              </span>
                            </div>
                            <p className="break-all text-xs text-white/60">
                              {urlText}
                            </p>
                          </div>
                          {detailHref ? (
                            <Button
                              asChild
                              variant="outline"
                              className="self-start rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                            >
                              <Link href={detailHref}>
                                Lihat detail
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                        </div>

                        <ProgressBar
                          value={completion}
                          label="Progres keseluruhan"
                        />

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                              Transcript ID
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {video.id || "Belum tersimpan"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                              Durasi
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {durationText}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                              Dibuat
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {createdLabel}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="md:self-end">
                        <div className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                              Quiz
                            </p>
                            <span
                              className={`inline-flex items-center gap-2 text-xs font-semibold ${video.quiz ? "text-emerald-100" : "text-white/70"}`}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${video.quiz ? "bg-emerald-300" : "bg-white/50"}`}
                              />
                              {quizStatusText}
                            </span>
                          </div>
                          <p className="text-sm text-white/70">
                            {video.quiz
                              ? "Quiz siap dimainkan. Buka untuk cek hasil."
                              : "Belum ada quiz. Buat sekarang dari hasil transcript."}
                          </p>
                          <div className="mt-auto space-y-2">
                            <Button
                              asChild
                              variant="secondary"
                              className="w-full bg-white/15 text-white hover:bg-white/20"
                            >
                              <Link href="/quiz">
                                Buat Quiz
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              className="w-full border-white/30 bg-white/5 text-white hover:bg-white/15"
                            >
                              <Link href={detailHref || "/quiz"}>
                                Lihat Detail
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white shadow-xl">
            <CardHeader>
              <CardTitle>Progres belajar</CardTitle>
              <CardDescription className="text-white/70">
                Pantau capaian utama sebelum lanjut ke video berikutnya.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {progressItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <ProgressBar value={item.value} label={item.label} />
                  <p className="mt-1 text-xs text-white/60">
                    {item.detail}
                  </p>
                </div>
              ))}

              <div className="mt-4 space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Riwayat singkat
                </p>
                {timelineEntries.length === 0 ? (
                  <p className="text-xs text-white/60">
                    Belum ada riwayat. Mulai transcribe untuk melihat
                    progres.
                  </p>
                ) : null}
                {timelineEntries.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        item.tone === "good"
                          ? "bg-emerald-300"
                          : "bg-white/50"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-white/60">
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-[#8b5cf6]/30 via-[#22d3ee]/25 to-[#4f46e5]/30 px-4 py-3">
                <PlayCircle className="h-5 w-5 text-emerald-100" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">
                    Waktunya lanjutkan transcribe berikutnya
                  </p>
                  <p className="text-xs text-white/70">
                    Sisipkan 15 menit hari ini untuk satu video pendek.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
