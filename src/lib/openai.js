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

function buildStubInsights(transcript, prompt, { quizCount = 10, durationSeconds = null } = {}) {
  const excerpt = transcript.slice(0, 180);
  const quizQuestions = Array.from({ length: quizCount }).map((_, idx) => {
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
  });

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
        { id: "n1", label: "Topik Utama", children: ["n2", "n3", "n4"], note: "Akar mindmap" },
        { id: "n2", label: "Subtopik 1", children: [] },
        { id: "n3", label: "Subtopik 2", children: [] },
        { id: "n4", label: "Subtopik 3", children: [] },
      ],
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

export async function generateInsightsFromTranscript(
  transcript,
  { prompt, videoTitle, quizCount: quizCountInput, durationSeconds } = {},
) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  const quizCount = quizCountInput ?? 10;
  const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : null;

  if (!process.env.OPENAI_API_KEY) {
    return buildStubInsights(transcript, prompt, { quizCount, durationSeconds });
  }

  const client = getOpenAIClient();
  const systemPrompt = `
Anda adalah asisten yang meringkas kajian/ceramah berbahasa Indonesia dan mengubahnya menjadi ringkasan terstruktur, quiz, serta mind map.

INPUT:
Satu teks transkrip kajian/ceramah dalam Bahasa Indonesia (tanpa markup lain).

OUTPUT:
Jawab HANYA dengan satu objek JSON valid (tanpa komentar, tanpa teks di luar JSON) dengan struktur:

{
  "summary": {
    "short": string,
    "bullet_points": string[],
    "detailed": string
  },
  "qa": {
    "sample_questions": [
      { "question": string, "answer": string }
    ]
  },
  "mindmap": {
    "title": string,
    "nodes": [
      {
        "id": string,
        "label": string,
        "children": string[],
        "note": string (opsional)
      }
    ]
  },
  "quiz": {
    "meta": {
      "total_questions": number,
      "duration_seconds": number | null
    },
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

KETENTUAN UMUM:
- Gunakan Bahasa Indonesia yang jelas dan ringkas.
- Fokus pada:
  - Dalil (ayat Al-Qur’an dan hadits) yang disebutkan.
  - Poin praktis: doa, amalan, sikap hati, langkah konkret.
- Pastikan JSON benar-benar valid (kutip ganda untuk string, tidak ada koma terakhir, dll).
- Jangan menulis apa pun di luar struktur JSON.
- **Mind map WAJIB disusun langsung dari isi transkrip, bukan dari hasil ringkasan.** 
  - Baca dan analisis transkrip terlebih dahulu.
  - Identifikasi topik, subtopik, contoh, dan dalil langsung dari kalimat/paragraf di transkrip.
  - Summary boleh memanfaatkan struktur mind map, tetapi mind map tidak boleh hanya turunan dari summary.

RINCIAN BAGIAN "summary":
1. "short": 1–3 kalimat ringkasan paling inti dari kajian.
2. "bullet_points":
   - Berisi 5–15 butir.
   - Setiap butir 1–2 kalimat.
   - Utamakan: definisi masalah, sebab, akibat, solusi, dan dalil.
3. "detailed":
   - Ringkasan naratif 4–8 paragraf.
   - Jelaskan alur: latar belakang masalah → penjelasan utama → dalil → solusi praktis → penutup.

RINCIAN BAGIAN "qa":
- "sample_questions": 5–10 pasang tanya–jawab.
- Bentuk:
  - "question": pertanyaan yang wajar ditanyakan jamaah (misal: “Apa yang dimaksud al-hamm dalam Islam?”).
  - "answer": jawaban singkat–padat (2–6 kalimat), merujuk isi kajian.
- Utamakan:
  - Makna istilah penting (misal: al-hamm, al-huzn).
  - Penjelasan dalil utama.
  - Contoh amalan/doa untuk diamalkan sehari-hari.

RINCIAN BAGIAN "mindmap":
Tujuan: menghasilkan struktur mind map HIERARKIS yang SANGAT RINCI, dengan banyak cabang dan subcabang, seperti contoh gambar (satu topik utama di kiri, bercabang ke beberapa tema besar, lalu pecah lagi ke subtopik).

1. ATURAN STRUKTUR:
   a. Tentukan satu TOPIK UTAMA dari seluruh kajian:
      - Tulis dalam 2–7 kata.
      - Letakkan sebagai:
        - "mindmap.title"
        - Serta sebagai NODE akar (level 0).
   b. Buat 4–8 CABANG UTAMA (level 1) dari topik utama:
      - Contoh pola umum (sesuaikan dengan isi kajian):
        - "Sifat Penyakit / Masalah"
        - "Tiga Poros Waktu"
        - "Universalitas Kegelisahan"
        - "Sebab & Akar Masalah"
        - "Solusi & Obat / Amalan"
        - "Buah & Akhir / Hasil Ketaatan"
      - Masing-masing cabang dengan label 1–5 kata.
   c. Uraikan tiap cabang utama menjadi SUBTOPIK (level 2, level 3, dan seterusnya):
      - Ambil poin-poin penting langsung dari transkrip:
        - daftar contoh (orang miskin, orang kaya, rakyat biasa, pejabat, orang tua, dll.),
        - kategori waktu (masa lalu, masa depan, masa kini),
        - jenis doa,
        - jenis amalan,
        - konsekuensi di dunia dan akhirat,
        - penjelasan ulama atau kisah.
      - Setiap subtopik 1–5 kata, bukan kalimat panjang.
      - Contoh: "Masa Lalu", "Masa Depan", "Masa Kini", "Orang Miskin", "Orang Kaya", "Rakyat Jelata", "Negarawan/Pejabat", "Orang Tua", "Doa Perlindungan 1", "Doa Al-Qur'an Penyejuk Hati", "Istighfar Rutin", "Iman kepada Takdir", dll.
   d. Jika ada dalil penting, buat node khusus:
      - Label ringkas, misalnya:
        - "Doa 1 (Perlindungan 8 Perkara)"
        - "Doa 2 (Al-Qur’an Penyejuk Hati)"
        - "Ayat: Kehidupan Bahagia (QS An-Nahl: 97)"
        - "Ucapan Ahli Surga (Alhamdulillahilladzi adzhaba ‘annal hazan)"
      - Node dalil ditempatkan di bawah cabang yang relevan (misal: “Solusi & Obat” → “Doa-doa dari Nabi” → dalil).
   e. TIDAK ada batasan jumlah node maupun jumlah tingkatan (level) node:
      - Buat sebanyak yang diperlukan selama struktur tetap jelas, hierarkis, dan mudah dipahami.
      - Usahakan mind map memiliki **minimal 25–30 node**; jika transkrip sangat kaya, boleh lebih (50+ node).

2. TINGKAT KERINCIAN (DETAIL):
   - Pecah ide besar menjadi beberapa level:
     - Contoh: "Solusi & Obat" → "Perbaiki Hubungan dengan Allah" → "Meninggalkan Maksiat", "Perbanyak Doa", "Amal Shalih", "Istighfar Rutin", "Iman kepada Takdir", dll.
   - Setiap kali transkrip menyebut DAFTAR berurutan (minimal 3 item), buat node terpisah untuk tiap item sebagai **saudara** (sibling):
     - Contoh: "Orang Miskin", "Orang Kaya", "Rakyat Jelata", "Pejabat/Negarawan", "Orang Tua".
   - Jika ada penjelasan berlapis, gunakan beberapa level:
     - Contoh: "Doa 1" → "Perlindungan dari al-Hamm", "Perlindungan dari al-Huzn", "Perlindungan dari ‘ajz", "Perlindungan dari kasal", dll.
   - Tambahkan node untuk:
     - definisi istilah penting (al-hamm, al-huzn),
     - dampak psikologis (tidak bisa tidur, sempitnya dada),
     - perbedaan dunia–akhirat (kegelisahan hilang total di surga),
     - kisah/perumpamaan (gunung, besi, api, air, angin, manusia).

3. ATURAN PENULISAN NODE:
   - Setiap objek dalam "nodes" minimal punya:
     - "id": string unik (misal "n1", "n2", "n3", dst).
     - "label": teks pendek (1–5 kata).
     - "children": array berisi daftar "id" anak. Jika tidak punya anak, tulis [].
   - Wajib gunakan "note" bila perlu menjelaskan makna node:
     - "note": 1–2 kalimat penjelas isi node (misal penjelasan singkat doa, atau ringkasan ayat).
   - Jangan mengisi "children" dengan objek, hanya dengan ID string.

4. KONEKSI ANTAR NODE:
   - Buat satu node akar:
     - { "id": "n1", "label": "<Topik Utama>", "children": ["n2","n3","n4", ...] }
   - Cabang utama (level 1) menjadikan "n1" sebagai parent.
   - Subtopik (level 2 dan seterusnya) menjadikan cabang di atasnya sebagai parent.
   - Pastikan tidak ada siklus; struktur harus murni pohon (tree).

5. FOKUS & KEJELASAN:
   - Hindari memasukkan ide yang terlalu kecil/remeh, tetapi jangan menggabungkan terlalu banyak ide berbeda dalam satu node.
   - Upayakan struktur yang mudah dibaca dari kiri ke kanan:
     - Akar → cabang besar → penjabaran → dalil/doa/praktik → rincian isi doa/ayat.
   - Tema-tema yang sering muncul seperti:
     - kondisi hati dan kegelisahan,
     - contoh kehidupan (miskin/kaya, rakyat/penguasa, orang tua tanpa anak),
     - hubungan dengan Allah dan maksiat,
     - doa-doa tertentu yang diajarkan Nabi,
     - iman pada takdir dan rasa ridha,
     - janji Allah bagi orang yang beramal shalih,
     harus tercermin sebagai node-node penting dengan subcabang yang cukup rinci.

RINCIAN BAGIAN "quiz":
- Buat total ${quizCount} soal pilihan ganda berbasis transkrip, bukan asumsi umum.
- "options" berisi tepat 4 opsi unik, jelas, dan bernuansa berbeda; hindari opsi yang hampir sama.
- Acak posisi jawaban benar; gunakan "correct_option_index" (0–3).
- "answer" harus sama persis dengan options[correct_option_index].
- "explanation" 1–3 kalimat yang merujuk dalil/contoh pada transkrip.
- Isi "meta.total_questions" dengan ${quizCount}; isi "meta.duration_seconds" dengan ${
      durationSeconds ?? "null"
    } (atau null jika tidak diketahui).

Terakhir:
- Baca dan pahami seluruh transkrip terlebih dahulu.
- Susun mind map yang sangat rinci dan bercabang banyak langsung dari isi transkrip sesuai aturan di atas.
- Keluarkan hanya JSON, tanpa teks lain.

Berikut transkrip kajian yang harus Anda ringkas dan petakan:

"[ISI TRANSKRIP]"
`.trim();

  const userContent = [
    `Judul/ konteks: ${videoTitle || "kajian YouTube"}.`,
    `Target soal kuis: ${quizCount} (durasi video ${
      durationMinutes !== null ? `${durationMinutes} menit` : "tidak diketahui"
    }).`,
    prompt ? `Permintaan tambahan: ${prompt}` : null,
    "Gunakan transcript berikut sebagai sumber:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
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
    quiz: parsed.quiz ?? {},
    model: completion.model ?? "openai",
  };
}

function buildUserContent({ videoTitle, prompt, transcript }) {
  return [
    `Judul/ konteks: ${videoTitle || "kajian YouTube"}.`,
    prompt ? `Permintaan tambahan: ${prompt}` : null,
    "Gunakan transcript berikut sebagai sumber:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateSummaryFromTranscript(transcript, { prompt, videoTitle } = {}) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt);
    return { summary: stub.summary, model: stub.model };
  }

  const client = getOpenAIClient();
  const systemPrompt = `
Anda adalah asisten yang merangkum transkrip kajian/ceramah dalam Bahasa Indonesia.
Keluarkan hanya JSON valid dengan struktur:
{
  "summary": {
    "short": "2-3 kalimat ringkasan inti",
    "bullet_points": ["5-12 butir, 1-2 kalimat per butir"],
    "detailed": "4-8 paragraf ringkasan naratif"
  }
}

Ketentuan:
- Bahasa Indonesia lugas dan singkat.
- Sertakan dalil/rujukan jika disebutkan.
- Tidak ada teks di luar JSON.`;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: buildUserContent({ videoTitle, prompt, transcript }) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM tidak mengembalikan konten ringkasan.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("LLM gagal menghasilkan JSON ringkasan.");
  }

  return {
    summary: parsed.summary ?? {},
    model: completion.model ?? "openai",
  };
}

export async function generateQaFromTranscript(transcript, { prompt, videoTitle } = {}) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt);
    return { qa: stub.qa, model: stub.model };
  }

  const client = getOpenAIClient();
  const systemPrompt = `
Anda menyusun 5-10 pasangan tanya-jawab dari transkrip kajian/ceramah Indonesia.
Keluarkan hanya JSON valid:
{
  "qa": {
    "sample_questions": [
      { "question": "pertanyaan singkat", "answer": "jawaban 2-6 kalimat" }
    ]
  }
}

Ketentuan:
- Pertanyaan fokus ke istilah penting, dalil, dan amalan praktis.
- Jawaban harus merujuk isi transkrip, bukan opini Anda.
- Tidak ada teks lain di luar JSON.`;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: buildUserContent({ videoTitle, prompt, transcript }) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM tidak mengembalikan konten Q&A.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("LLM gagal menghasilkan JSON Q&A.");
  }

  return {
    qa: parsed.qa ?? {},
    model: completion.model ?? "openai",
  };
}

export async function generateMindmapFromTranscript(transcript, { prompt, videoTitle } = {}) {
  if (!transcript?.trim()) {
    throw new Error("Transcript kosong atau tidak ditemukan.");
  }

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt);
    const outline = stub.summary?.bullet_points?.map((p, i) => `${i + 1}. ${p}`).join("\n");
    return {
      mindmap: { ...stub.mindmap, outline_markdown: outline },
      model: stub.model,
    };
  }

  const client = getOpenAIClient();
  const systemPrompt = `
Anda menyusun mind map HIERARKIS dari transkrip kajian/ceramah Indonesia.
Keluarkan hanya JSON valid dengan struktur:
{
  "mindmap": {
    "title": "judul pendek",
    "outline_markdown": "opsional, markdown bercabang",
    "nodes": [
      { "id": "n1", "label": "Topik Utama", "children": ["n2","n3"], "note": "opsional 1-2 kalimat" }
    ]
  }
}

Aturan:
- Node akar wajib bernama n1 dan menjadi parent semua cabang.
- Buat 4-8 cabang utama (level 1) lalu pecah menjadi subtopik (level 2/3/4) sesuai isi transkrip.
- Minimal 20-30 node bila transkrip kaya, boleh lebih.
- label 1-5 kata; gunakan "note" untuk penjelasan singkat atau dalil.
- Hindari siklus; struktur harus tree.
- Tidak ada teks di luar JSON.`;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt.trim() },
      { role: "user", content: buildUserContent({ videoTitle, prompt, transcript }) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM tidak mengembalikan konten mindmap.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("LLM gagal menghasilkan JSON mindmap.");
  }

  return {
    mindmap: parsed.mindmap ?? {},
    model: completion.model ?? "openai",
  };
}
