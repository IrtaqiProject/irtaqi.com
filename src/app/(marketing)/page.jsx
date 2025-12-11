import {
  ArrowRight,
  BookOpen,
  Brain,
  Database,
  Globe,
  Moon,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const aiPillars = [
  {
    title: "Transcribe lectures",
    description:
      "Proses otomatis kajian Indonesia untuk mendapatkan transcript yang bisa diedit.",
    icon: <BookOpen className="h-5 w-5 text-emerald-400" />,
    badge: "Step 1",
  },
  {
    title: "Ringkas & tandai dalil",
    description:
      "AI menarik poin utama, ayat dan hadits, serta membuat versi ringkas dan detail untuk belajar.",
    icon: <Sparkles className="h-5 w-5 text-amber-300" />,
    badge: "Step 2",
  },
  {
    title: "Mindmap hidup",
    description:
      "Visualisasi hierarki topik dengan mindmap interaktif agar konsep lebih mudah dipahami.",
    icon: <Globe className="h-5 w-5 text-indigo-300" />,
    badge: "Step 3",
  },
  {
    title: "Quiz interaktif",
    description:
      "Hasilkan soal MCQ, benar/salah, atau short answer untuk belajar ala Kahoot/Quizizz.",
    icon: <Brain className="h-5 w-5 text-sky-300" />,
    badge: "Step 4",
  },
];

const features = [
  {
    title: "Summaries otomatis",
    detail:
      "Highlight ayat, hadits, dan poin utama dalam format singkat & detail.",
  },
  {
    title: "Quiz & gamifikasi",
    detail:
      "Format beragam dengan skor, progres, dan pengalaman belajar fun.",
  },
  {
    title: "Mindmap interaktif",
    detail:
      "Jelajahi sub-topik secara visual untuk retensi lebih baik.",
  },
  {
    title: "Pencarian & filter",
    detail:
      "Cari berdasarkan tema, ustadz, durasi, atau tingkat kesulitan.",
  },
  {
    title: "Personalization",
    detail:
      "Favorit, mode terang/gelap, dan download materi teks offline.",
  },
  {
    title: "Progress tracking",
    detail:
      "Dashboard pribadi dengan riwayat kajian, quiz score, dan tren belajar.",
  },
];

const stats = [
  { label: "Lectures processed", value: "10K+" },
  { label: "Auto quizzes", value: "45K" },
  { label: "Avg. retention", value: "2.3x" },
];

const popularTracks = [
  {
    title: "Tadabbur Juz Amma",
    meta: "Ringkas + mindmap + quiz 10 soal",
    color: "from-[#8b5cf6]/70 to-[#4f46e5]/80",
  },
  {
    title: "Fiqih Ibadah Harian",
    meta: "Transcript + highlight dalil + quiz 8 soal",
    color: "from-[#a855f7]/70 to-[#ec4899]/80",
  },
  {
    title: "Sirah Nabawiyah",
    meta: "Timeline + mindmap + quiz 12 soal",
    color: "from-[#6366f1]/70 to-[#22d3ee]/70",
  },
  {
    title: "Adab & Akhlak",
    meta: "Ringkas cepat + mindmap ringan",
    color: "from-[#9333ea]/70 to-[#7c3aed]/80",
  },
  {
    title: "Tauhid & Aqidah",
    meta: "Highlight ayat/hadits + quiz 15 soal",
    color: "from-[#c084fc]/70 to-[#a855f7]/80",
  },
  {
    title: "Bahasa Arab Kajian",
    meta: "Vocabulary builder + quiz fill-the-blank",
    color: "from-[#7dd3fc]/70 to-[#818cf8]/80",
  },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-[#9b5cff]/25 blur-3xl" />
        <div className="absolute right-[-10%] top-32 h-72 w-72 rounded-full bg-[#ff4fd8]/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[20%] h-72 w-72 rounded-full bg-[#6f9bff]/18 blur-3xl" />
      </div>

      <section className="container relative flex flex-col gap-10 py-16 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-emerald-200 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Irtaqi.com — Deep & Fun Islamic Learning
          </div>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Transformasi kajian jadi{" "}
            <span className="text-transparent bg-gradient-to-r from-[#ffd3ff] via-[#d690ff] to-[#7aa6ff] bg-clip-text">
              ilmu interaktif
            </span>{" "}
            dengan AI.
          </h1>
          <p className="max-w-3xl text-lg text-white/70">
            Platform belajar web yang bikin satu ceramah panjang
            langsung berubah jadi transcript rapi, ringkasan padat,
            kuis seru, mindmap interaktif, dan dashboard progres yang
            jelas. Bukan cuma nonton lewat, tapi benar-benar paham dan
            bisa ngukur sejauh apa kamu berkembang.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-brand">
              <Link href="/transcribe">
                Mulai dari YouTube video
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/signup">Buat akun gratis</Link>
            </Button>
            {/* <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
            >
              <Link href="/mermaid">Lihat mindmap sample</Link>
            </Button> */}
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              <Search className="h-4 w-4" /> Cari kajian: tema,
              ustadz, durasi
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              <Moon className="h-4 w-4" /> Mode terang/gelap siap
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              <Database className="h-4 w-4" /> Favorit & download teks
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((item) => (
              <Card
                key={item.label}
                className="border-white/10 bg-white/5 text-white"
              >
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {item.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                  AI Flow
                </p>
                <p className="text-xl font-semibold text-white">
                  Kajian → Transcript → Summarize → QA → Mindmap →
                  Quiz
                </p>
              </div>
              <Wand2 className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="space-y-3">
              {aiPillars.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    {item.icon}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                        {item.badge}
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                    </div>
                    <p className="text-sm text-white/70">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container relative space-y-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              Fitur unggulan
            </p>
            <h2 className="text-3xl font-bold text-white">
              Belajar mendalam, seru, dan terstruktur
            </h2>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/health">Cek health server</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-white/10 bg-white/5 text-white transition hover:-translate-y-1 hover:border-emerald-200/30 hover:shadow-brand"
            >
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="text-white/70">
                  {feature.detail}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Siap pakai dengan Next.js + server actions
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container relative space-y-6 pb-20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              Pilihan populer
            </p>
            <h3 className="text-2xl font-bold text-white">
              Track kajian yang sudah diolah AI
            </h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Content dapat dicari & difilter (login untuk memulai)
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {popularTracks.map((track) => (
            <Card
              key={track.title}
              className="overflow-hidden border-none bg-gradient-to-br text-white shadow-lg transition hover:-translate-y-1"
              style={{ backgroundImage: undefined }}
            >
              <div
                className={`h-36 w-full rounded-b-[32px] bg-gradient-to-br ${track.color} opacity-90`}
              />
              <CardHeader className="-mt-12">
                <CardTitle className="text-xl">
                  {track.title}
                </CardTitle>
                <CardDescription className="text-white/80">
                  {track.meta}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white/80" />
                  Transcript + ringkas + quiz + mindmap
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25"
                >
                  Lihat detail
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
