import OpenAI from "openai";

let cachedClient = null;

export function getOpenAIClient() {
  if (cachedClient) return cachedClient;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local.");
  }
  cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

export async function transcribeAudioStub(source, prompt) {
  // Placeholder to avoid network calls during development.
  return {
    text: `Transcription placeholder for "${source}"${prompt ? ` with prompt "${prompt}"` : ""}.`,
  };
}

function buildStubInsights(transcript, prompt) {
  const excerpt = transcript.slice(0, 180);
  return {
    summary: {
      short: `Ringkasan cepat: ${excerpt}${transcript.length > excerpt.length ? "..." : ""}`,
      bullet_points: [
        "Poin inti 1 dari transcript.",
        "Poin inti 2 dengan dalil atau rujukan bila ada.",
        "Poin inti 3 yang dapat diaksi.",
      ],
      detailed: `Rangkuman detail berbasis transcript. Prompt: ${prompt || "tidak ada"}.`,
    },
    qa: {
      sample_questions: [
        { question: "Apa fokus utama kajian ini?", answer: "Pembahasan inti dijelaskan di ringkasan." },
        { question: "Dalil yang disebutkan?", answer: "Lihat bullet ringkasan untuk rujukan singkat." },
      ],
    },
    mindmap: {
      title: "Mindmap Kajian",
      nodes: [
        { id: "root", label: "Topik Utama", children: ["p1", "p2", "p3"] },
        { id: "p1", label: "Subtopik 1" },
        { id: "p2", label: "Subtopik 2" },
        { id: "p3", label: "Subtopik 3" },
      ],
    },
    model: "stub-no-openai-key",
  };
}

export async function generateInsightsFromTranscript(transcript, { prompt, videoTitle } = {}) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return buildStubInsights(transcript, prompt);
  }

  const client = getOpenAIClient();
  const systemPrompt = [
    "Anda adalah asisten yang meringkas kajian/ceramah Bahasa Indonesia.",
    "Hasilkan JSON dengan kunci: summary { short, bullet_points[], detailed },",
    "qa { sample_questions[] dengan question & answer }, dan mindmap { title, nodes[].",
    "Nodes minimal punya id dan label, boleh ada children: [] berupa id lain }.",
    "Tulis ringkasan dalam Bahasa Indonesia, fokus pada dalil (ayat/hadits) jika ada, dan poin praktis.",
    "Pastikan respons JSON valid.",
  ].join(" ");

  const userContent = [
    `Judul/ konteks: ${videoTitle || "kajian YouTube"}.`,
    prompt ? `Permintaan tambahan: ${prompt}` : null,
    "Gunakan transcript berikut sebagai sumber:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM tidak mengembalikan konten.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("LLM gagal menghasilkan JSON ringkasan.");
  }

  return {
    summary: parsed.summary ?? {},
    qa: parsed.qa ?? {},
    mindmap: parsed.mindmap ?? {},
    model: completion.model ?? "openai",
  };
}
