import fs from "node:fs";
import OpenAI from "openai";

import { getCachedCompletion, setCachedCompletion } from "./llm-cache";

let cachedClient = null;

export function getOpenAIClient() {
  if (cachedClient) return cachedClient;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local."
    );
  }
  cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

function resolveModel() {
  return process.env.OPENAI_MODEL ?? "gpt-5-mini";
}

function toSrtTimestamp(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const date = new Date(safeSeconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
}

function segmentsToSrt(segments) {
  if (!Array.isArray(segments) || !segments.length) return "";
  return segments
    .map((seg, idx) => {
      const start = Number(seg?.start ?? 0);
      const end =
        seg?.end !== undefined
          ? Number(seg.end)
          : start + Number(seg?.duration ?? 0);
      const text = seg?.text?.trim() || "";
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
        return null;
      }
      return `${idx + 1}\n${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}\n${text}\n`;
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeTranscriptText(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

export async function transcribeAudioStub(source, prompt) {
  // Placeholder to avoid network calls during development.
  const placeholder = `Transcription placeholder for "${source}"${
    prompt ? ` with prompt "${prompt}"` : ""
  }.`;
  const segments = [{ start: 0, end: 5, duration: 5, text: placeholder }];
  return {
    text: placeholder,
    srt: segmentsToSrt(segments),
    segments,
    durationSeconds: 5,
    model: "stub-no-openai-key",
    lang: "id",
    language: "id",
  };
}

export async function transcribeAudioWithWhisper(
  filePath,
  { prompt, language = "id" } = {},
) {
  if (!filePath) {
    throw new Error("Path audio tidak ditemukan untuk transkripsi.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return transcribeAudioStub(filePath, prompt);
  }

  try {
    const client = getOpenAIClient();
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      prompt: prompt || undefined,
      language,
      response_format: "verbose_json",
      temperature: 0,
    });

    const rawSegments = Array.isArray(transcription.segments)
      ? transcription.segments
      : [];

    const segments = rawSegments.map((seg) => {
      const start = Number(seg?.start ?? 0);
      const end = Number(seg?.end ?? start);
      return {
        id: seg?.id,
        start,
        end,
        duration: Math.max(0, end - start),
        text: seg?.text?.trim() ?? "",
      };
    });

    const text =
      normalizeTranscriptText(
        transcription.text ?? segments.map((s) => s.text).join(" "),
      ) || "";
    const srt = segmentsToSrt(segments);
    const fallbackDuration = segments.reduce(
      (max, seg) => Math.max(max, Number(seg?.end ?? 0)),
      0,
    );
    const durationSeconds =
      typeof transcription.duration === "number" && transcription.duration > 0
        ? Math.round(transcription.duration)
        : fallbackDuration > 0
          ? Math.round(fallbackDuration)
          : null;

    return {
      text,
      srt,
      segments,
      durationSeconds,
      model: transcription.model ?? "whisper-1",
      lang: transcription.language ?? null,
      language: transcription.language ?? null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transkripsi Whisper gagal.";
    throw new Error(`Gagal mentranskripsi audio: ${message}`);
  }
}

export function buildStubInsights(
  transcript,
  prompt,
  { quizCount = 10, durationSeconds = null } = {}
) {
  const excerpt = transcript.slice(0, 180);
  const quizQuestions = Array.from({ length: quizCount }).map(
    (_, idx) => {
      const qNumber = idx + 1;
      const options = [
        `Pilihan A untuk soal ${qNumber}`,
        `Pilihan B untuk soal ${qNumber}`,
        `Pilihan C untuk soal ${qNumber}`,
        `Pilihan D untuk soal ${qNumber}`,
      ];
      return {
        question: `Contoh soal ${qNumber} dari transkrip.`,
        options,
        correct_option_index: qNumber % 4,
        answer: options[qNumber % 4],
        explanation: "Penjelasan singkat jawaban benar dari materi.",
      };
    }
  );

  return {
    summary: {
      short: `Ringkasan cepat: ${excerpt}${
        transcript.length > excerpt.length ? "..." : ""
      }`,
      bullet_points: [
        "Poin inti 1 dari transcript.",
        "Poin inti 2 dengan dalil atau rujukan bila ada.",
        "Poin inti 3 yang dapat diaksi.",
      ],
      detailed: `Rangkuman detail berbasis transcript. Prompt: ${
        prompt || "tidak ada"
      }.`,
    },
    qa: {
      sample_questions: [
        {
          question: "Apa fokus utama kajian ini?",
          answer: "Pembahasan inti dijelaskan di ringkasan.",
        },
        {
          question: "Dalil yang disebutkan?",
          answer: "Lihat bullet ringkasan untuk rujukan singkat.",
        },
      ],
    },
    mindmap: {
      title: "Mindmap Kajian",
      nodes: [
        {
          id: "n1",
          label: "Topik Utama",
          children: ["n2", "n3", "n4"],
          note: "Akar mindmap",
        },
        { id: "n2", label: "Subtopik 1", children: [] },
        { id: "n3", label: "Subtopik 2", children: [] },
        { id: "n4", label: "Subtopik 3", children: [] },
      ],
      outline_markdown:
        "- Topik Utama\n  - Subtopik 1\n  - Subtopik 2\n  - Subtopik 3",
    },
    quiz: {
      meta: {
        total_questions: quizCount,
        duration_seconds: durationSeconds,
      },
      questions: quizQuestions,
    },
    model: "stub-no-openai-key",
  };
}

function buildUserContent({
  videoTitle,
  prompt,
  transcript,
  durationSeconds = null,
  extras = [],
}) {
  const durationMinutes =
    typeof durationSeconds === "number"
      ? Math.round(durationSeconds / 60)
      : null;
  return [
    `Judul/konteks: ${videoTitle || "kajian YouTube"}.`,
    durationMinutes !== null
      ? `Durasi video: ${durationMinutes} menit.`
      : null,
    ...extras,
    prompt ? `Permintaan tambahan: ${prompt}` : null,
    "Gunakan transcript berikut sebagai sumber:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildSummaryPrompt({
  videoTitle,
  prompt,
  transcript,
  durationSeconds,
}) {
  const systemPrompt = `
Anda adalah asisten yang meringkas kajian/ceramah berbahasa Indonesia.

OUTPUT: Satu objek JSON valid:
{
  "summary": {
    "short": string,
    "bullet_points": string[],
    "detailed": string
  }
}

Ketentuan:
- Gunakan Bahasa Indonesia yang jelas dan ringkas.
- Semua isi harus merujuk langsung ke transkrip, bukan asumsi umum.
- "short": 1–3 kalimat inti dari kajian.
- "bullet_points": 5–15 butir, tiap butir 1–2 kalimat; utamakan definisi masalah, sebab, akibat, solusi, dan dalil.
- "detailed": 4–8 paragraf naratif (latar belakang → penjelasan utama → dalil → solusi praktis → penutup).
- Jangan menulis apa pun di luar objek JSON.
`.trim();

  const userContent = buildUserContent({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });

  return { systemPrompt, userContent };
}

export function buildQaPrompt({
  videoTitle,
  prompt,
  transcript,
  durationSeconds,
}) {
  const systemPrompt = `
Anda adalah asisten Q&A untuk kajian/ceramah berbahasa Indonesia.

OUTPUT: Satu objek JSON valid:
{
  "qa": {
    "sample_questions": [
      { "question": string, "answer": string }
    ]
  }
}

Ketentuan:
- Buat 5–10 pasang tanya–jawab.
- Pertanyaan harus wajar ditanyakan jamaah; jawaban 2–6 kalimat, padat, merujuk isi transkrip.
- Sorot istilah penting, dalil utama, contoh amalan atau doa jika ada.
- Jangan menulis apa pun di luar objek JSON; seluruh isi harus bersumber langsung dari transkrip.
`.trim();

  const userContent = buildUserContent({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });

  return { systemPrompt, userContent };
}

export function buildMindmapPrompt({
  videoTitle,
  prompt,
  transcript,
  durationSeconds,
}) {
  const systemPrompt = `
Anda membangun mind map hierarkis dari transkrip kajian berbahasa Indonesia.

OUTPUT: Satu objek JSON valid:
{
  "mindmap": {
    "title": string,
    "nodes": [
      { "id": string, "label": string, "children": string[], "note": string (opsional) }
    ],
    "outline_markdown": string (opsional)
  }
}

Ketentuan:
- Tentukan satu topik utama sebagai "title" dan node akar (id "n1") yang memiliki 4–8 cabang utama (level 1).
- Pecah tiap cabang utama menjadi subtopik level 2/3 sesuai isi transkrip; gunakan label 1–5 kata.
- Sertakan node dalil/doa penting; gunakan "note" (1–2 kalimat) bila butuh penjelasan ringkas.
- Minimal 25–30 node bila materi kaya; struktur harus pohon tanpa siklus; "children" hanya berisi ID string.
- Semua node harus diambil langsung dari transkrip, bukan dari ringkasan atau asumsi.
- "outline_markdown" boleh diisi outline hierarki dalam markdown.
- Jangan menulis apa pun di luar objek JSON.
`.trim();

  const userContent = buildUserContent({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });

  return { systemPrompt, userContent };
}

export function buildQuizPrompt({
  videoTitle,
  prompt,
  transcript,
  durationSeconds,
  quizCount,
}) {
  const systemPrompt = `
Anda membuat soal pilihan ganda dari transkrip kajian berbahasa Indonesia.

OUTPUT: Satu objek JSON valid:
{
  "quiz": {
    "meta": { "total_questions": number, "duration_seconds": number | null },
    "questions": [
      {
        "question": string,
        "options": [string, string, string, string],
        "correct_option_index": number,
        "answer": string,
        "explanation": string
      }
    ]
  }
}

Ketentuan:
- Buat total ${quizCount} soal berbasis transkrip (bukan asumsi umum).
- "options" berisi 4 opsi unik dan jelas; acak posisi jawaban benar.
- "correct_option_index" (0–3) harus menunjuk opsi benar; "answer" harus sama dengan options[correct_option_index].
- "explanation" 1–3 kalimat yang merujuk dalil/contoh pada transkrip.
- Isi "meta.total_questions" dengan ${quizCount}; isi "meta.duration_seconds" dengan ${
    durationSeconds ?? "null"
  }.
- Gunakan Bahasa Indonesia yang ringkas; jangan menulis apa pun di luar objek JSON.
`.trim();

  const extras = [
    `Target soal kuis: ${quizCount}.`,
    durationSeconds !== undefined
      ? `Durasi video: ${
          durationSeconds !== null
            ? `${Math.round(durationSeconds / 60)} menit`
            : "tidak diketahui"
        }.`
      : null,
  ];

  const userContent = buildUserContent({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
    extras,
  });

  return { systemPrompt, userContent };
}

async function runJsonCompletion({ systemPrompt, userContent }) {
  const { key, completion: cached } = await getCachedCompletion({
    systemPrompt,
    userContent,
  });

  const completion =
    cached ??
    (await (async () => {
      const client = getOpenAIClient();
      const model = resolveModel();
      const fresh = await client.chat.completions.create({
        model,
        ...(model?.startsWith("gpt-5") ? {} : { temperature: 0.4 }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      });
      await setCachedCompletion(key, fresh);
      return fresh;
    })());

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM tidak mengembalikan konten.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("LLM gagal menghasilkan JSON.");
  }

  return { parsed, model: completion.model ?? "openai" };
}

export async function streamJsonCompletion({ systemPrompt, userContent }) {
  const client = getOpenAIClient();
  const model = resolveModel();
  const stream = await client.chat.completions.create({
    model,
    ...(model?.startsWith("gpt-5") ? {} : { temperature: 0.4 }),
    response_format: { type: "json_object" },
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  return { stream, model };
}

export async function generateSummaryFromTranscript(
  transcript,
  { prompt, videoTitle, durationSeconds } = {}
) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt, {
      durationSeconds,
    });
    return { summary: stub.summary, model: stub.model };
  }

  const { systemPrompt, userContent } = buildSummaryPrompt({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });
  const { parsed, model } = await runJsonCompletion({
    systemPrompt,
    userContent,
  });

  return { summary: parsed.summary ?? {}, model };
}

export async function generateQaFromTranscript(
  transcript,
  { prompt, videoTitle, durationSeconds } = {}
) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt, {
      durationSeconds,
    });
    return { qa: stub.qa, model: stub.model };
  }

  const { systemPrompt, userContent } = buildQaPrompt({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });
  const { parsed, model } = await runJsonCompletion({
    systemPrompt,
    userContent,
  });

  return { qa: parsed.qa ?? {}, model };
}

export async function generateMindmapFromTranscript(
  transcript,
  { prompt, videoTitle, durationSeconds } = {}
) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt, {
      durationSeconds,
    });
    return { mindmap: stub.mindmap, model: stub.model };
  }

  const { systemPrompt, userContent } = buildMindmapPrompt({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
  });
  const { parsed, model } = await runJsonCompletion({
    systemPrompt,
    userContent,
  });

  return { mindmap: parsed.mindmap ?? {}, model };
}

export async function generateQuizFromTranscript(
  transcript,
  {
    prompt,
    videoTitle,
    quizCount: quizCountInput = 10,
    durationSeconds,
  } = {}
) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  const quizCount = quizCountInput ?? 10;

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt, {
      quizCount,
      durationSeconds,
    });
    return { quiz: stub.quiz, model: stub.model };
  }

  const { systemPrompt, userContent } = buildQuizPrompt({
    videoTitle,
    prompt,
    transcript,
    durationSeconds,
    quizCount,
  });
  const { parsed, model } = await runJsonCompletion({
    systemPrompt,
    userContent,
  });

  return { quiz: parsed.quiz ?? {}, model };
}
