"use client";

import { Suspense, useEffect } from "react";
import { atom, useAtom } from "jotai";
import Link from "next/link";
import { Download, FileText, Loader2, PlayCircle, Rocket } from "lucide-react";
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

function cleanTranscriptText(text = "") {
  if (!text) return "";
  const stripped = text
    .replace(/\r/g, "\n")
    .replace(/<\/?c[^>]*>/gi, " ")
    .replace(/<\d{2}:\d{2}:\d{2}[.,]\d{3}>/g, " ")
    .replace(/<[^>]+>/g, " ");
  const paragraphs = stripped
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length) {
    return paragraphs.join("\n\n");
  }
  return stripped.replace(/\s+/g, " ").trim();
}

function getPlainTranscript(result) {
  if (!result) return "";
  if (Array.isArray(result.paragraphs) && result.paragraphs.length) {
    const merged = result.paragraphs
      .map((item) => cleanTranscriptText(item))
      .filter(Boolean);
    if (merged.length) return merged.join(" ");
  }
  const directText = cleanTranscriptText(result.transcript);
  if (directText) return directText;
  return "";
}

function resolveTranscriptParagraphs(result) {
  if (!result) return [];
  const provided =
    Array.isArray(result.paragraphs) && result.paragraphs.length
      ? result.paragraphs
          .map((item) => cleanTranscriptText(item))
          .filter(Boolean)
      : [];
  if (provided.length) return provided;

  const cleaned = cleanTranscriptText(result.transcript);
  if (!cleaned) return [];

  if (cleaned.includes("\n")) {
    const splitByBreaks = cleaned
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (splitByBreaks.length) return splitByBreaks;
  }

  return formatTranscriptParagraphs(cleaned);
}

function chunkWords(text, maxWords = 120) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

function formatTranscriptParagraphs(text) {
  const cleaned = cleanTranscriptText(text);
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const paragraphs = [];
  let bucket = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    bucket.push(trimmed);
    const wordCount = bucket.join(" ").split(/\s+/).length;
    if (bucket.length >= 3 || wordCount >= 90) {
      paragraphs.push(bucket.join(" "));
      bucket = [];
    }
  }
  if (bucket.length) paragraphs.push(bucket.join(" "));

  if (!paragraphs.length) return chunkWords(cleaned, 90);

  const expanded = [];
  for (const para of paragraphs) {
    const wordCount = para.split(/\s+/).length;
    if (wordCount <= 120) {
      expanded.push(para);
    } else {
      expanded.push(...chunkWords(para, 90));
    }
  }
  return expanded;
}

function wrapLines(paragraphs, maxLen = 92) {
  const safeParagraphs = Array.isArray(paragraphs)
    ? paragraphs.map((p) => p.trim()).filter(Boolean)
    : [];
  if (!safeParagraphs.length) return [""];

  const lines = [];
  for (const para of safeParagraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxLen && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    lines.push(""); // spacer between paragraphs
  }
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length ? lines : [""];
}

function chunkLines(lines, size = 48) {
  const pages = [];
  for (let i = 0; i < lines.length; i += size) {
    pages.push(lines.slice(i, i + size));
  }
  return pages.length ? pages : [[""]];
}

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfDocument(title, paragraphs) {
  const header = title?.trim() || "Transkrip Video";
  const resolvedParagraphs = Array.isArray(paragraphs)
    ? paragraphs
    : formatTranscriptParagraphs(paragraphs || "");
  const lines = wrapLines(resolvedParagraphs, 92);
  const printable = [header, "", ...lines];
  const pages = chunkLines(printable);
  const objects = [];

  // Pre-calc object ids
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const contentIds = pages.map((_, idx) => 4 + idx * 2);
  const pageIds = pages.map((_, idx) => 5 + idx * 2);

  objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });
  objects.push({
    id: pagesId,
    content: `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`,
  });
  objects.push({ id: fontId, content: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" });

  pages.forEach((pageLines, idx) => {
    const textOps = pageLines
      .map((line, lineIdx) => `${lineIdx === 0 ? "" : "T*"} (${escapePdfText(line || " ")}) Tj`)
      .join("\n");
    const contentStream = ["BT", "/F1 12 Tf", "14 TL", "50 780 Td", textOps, "ET"].join("\n");
    const encodedLength = new TextEncoder().encode(contentStream).length;
    const contentId = contentIds[idx];
    const pageId = pageIds[idx];

    objects.push({
      id: contentId,
      content: `<< /Length ${encodedLength} >>\nstream\n${contentStream}\nendstream`,
    });
    objects.push({
      id: pageId,
      content: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    });
  });

  const pdfParts = ["%PDF-1.4\n"];
  const xrefEntries = ["0000000000 65535 f \n"];
  let offset = pdfParts[0].length;

  for (const obj of objects) {
    const objString = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    const padded = String(offset).padStart(10, "0");
    xrefEntries.push(`${padded} 00000 n \n`);
    pdfParts.push(objString);
    offset += objString.length;
  }

  const xrefOffset = offset;
  pdfParts.push(
    `xref\n0 ${objects.length + 1}\n${xrefEntries.join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return pdfParts.join("");
}

function buildWordDocument(title, body) {
  const header = title?.trim() || "Transkrip Video";
  const paragraphs = Array.isArray(body)
    ? body
    : formatTranscriptParagraphs(body || "");
  const esc = (txt) =>
    txt
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}")
      .replace(/\n/g, "\\line ");

  const content = paragraphs.length
    ? paragraphs.map((p) => `\\pard ${esc(p)}\\par`).join("\n")
    : "\\pard Transcript kosong\\par";

  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\n{\\colortbl;\\red0\\green0\\blue0;}\n\\viewkind4\\uc1\n\\pard\\sa200\\b\\fs28 ${esc(header)}\\b0\\par\n${content}\n}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const transcriptParagraphsAtom = atom((get) =>
  resolveTranscriptParagraphs(get(transcriptResultAtom))
);

const cleanTranscriptAtom = atom((get) => {
  const paragraphs = get(transcriptParagraphsAtom);
  if (paragraphs.length) return paragraphs.join("\n\n");
  return getPlainTranscript(get(transcriptResultAtom));
});

const downloadParagraphsAtom = atom((get) =>
  get(transcriptParagraphsAtom)
);

const displayTranscriptAtom = atom((get) => {
  const paragraphs = get(downloadParagraphsAtom);
  const clean = get(cleanTranscriptAtom);
  return paragraphs.length ? paragraphs.join("\n\n") : clean;
});

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
  const isUnauthenticated = status === "unauthenticated";
  const isLoadingSession = status === "loading";

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

  const srtText = result?.srt ?? "";
  const derivedVideoId = extractVideoIdFromUrl(youtubeUrl);
  const activeVideoId = derivedVideoId ?? result?.videoId ?? null;
  const embedUrl = activeVideoId
    ? `https://www.youtube.com/embed/${activeVideoId}`
    : null;
  const previewUrlText = youtubeUrl || result?.youtubeUrl || "";
  const [cleanTranscript] = useAtom(cleanTranscriptAtom);
  const [downloadParagraphs] = useAtom(downloadParagraphsAtom);
  const [displayTranscript] = useAtom(displayTranscriptAtom);
  const hasTranscript = Boolean(downloadParagraphs.length || cleanTranscript?.trim());

  const handleDownload = (format) => {
    if (typeof window === "undefined" || !hasTranscript) return;
    const paragraphs = downloadParagraphs.length
      ? downloadParagraphs
      : cleanTranscript?.trim()
        ? [cleanTranscript.trim()]
        : [];
    if (!paragraphs.length) return;
    const title = result?.youtubeUrl || "Transkrip Video YouTube";
    const baseName = activeVideoId ? `transcript-${activeVideoId}` : "transcript-youtube";
    if (format === "pdf") {
      const pdfDoc = buildPdfDocument(title, paragraphs);
      triggerDownload(new Blob([pdfDoc], { type: "application/pdf" }), `${baseName}.pdf`);
      return;
    }
    const wordDoc = buildWordDocument(title, paragraphs);
    triggerDownload(new Blob([wordDoc], { type: "application/rtf" }), `${baseName}.doc`);
  };

  if (isUnauthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#1b1145] via-[#130d32] to-[#0b0820] text-white">
        <p className="text-sm text-white/70">
          Mengalihkan ke halaman login...
        </p>
      </main>
    );
  }

  if (isLoadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#120b34] via-[#0f0a26] to-[#0a0b1a] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </main>
    );
  }

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
                  Mengambil subtitle VTT YouTube dan merapikan transcript.
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Download Transcribe
                    </p>
                    <p className="text-xs text-white/70">
                      Teks tanpa time frame, simpan langsung sebagai Word atau PDF.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-white text-[#120b34] hover:brightness-105"
                      onClick={() => handleDownload("word")}
                      disabled={!hasTranscript}
                    >
                      <Download className="h-4 w-4" />
                      Word (.doc)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-emerald-500 text-white hover:brightness-110"
                      onClick={() => handleDownload("pdf")}
                      disabled={!hasTranscript}
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
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
                      {displayTranscript || "Belum ada transcript."}
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
