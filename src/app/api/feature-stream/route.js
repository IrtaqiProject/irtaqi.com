import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import {
  getTranscriptById,
  listTranscripts,
  saveTranscriptResult,
  updateTranscriptFeatures,
} from "@/lib/db";
import { getCachedCompletion, setCachedCompletion } from "@/lib/llm-cache";
import {
  buildMindmapPrompt,
  buildQaPrompt,
  buildQuizPrompt,
  buildStubInsights,
  buildSummaryPrompt,
  streamJsonCompletion,
} from "@/lib/openai";
import { authOptions } from "@/lib/auth";
import { consumeUserTokens, getUserAccount } from "@/lib/user-store";

const encoder = new TextEncoder();

const FEATURE_CONFIG = {
  summary: {
    key: "summary",
    buildPrompt: buildSummaryPrompt,
    extractResult: (parsed) => parsed?.summary ?? {},
  },
  qa: {
    key: "qa",
    buildPrompt: buildQaPrompt,
    extractResult: (parsed) => parsed?.qa ?? {},
  },
  mindmap: {
    key: "mindmap",
    buildPrompt: buildMindmapPrompt,
    extractResult: (parsed) => parsed?.mindmap ?? {},
  },
  quiz: {
    key: "quiz",
    buildPrompt: buildQuizPrompt,
    extractResult: (parsed) => parsed?.quiz ?? {},
    includeDuration: true,
  },
};

function resolveVideoTitle(videoId, youtubeUrl) {
  if (youtubeUrl) return youtubeUrl;
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  return "Transkrip YouTube";
}

function decideQuizCount(durationSeconds) {
  if (!durationSeconds || Number.isNaN(durationSeconds)) return 10;
  const minutes = durationSeconds / 60;
  if (minutes < 15) return 10;
  if (minutes < 30) return 15;
  if (minutes < 60) return 25;
  if (minutes > 120) return 30;
  return 25;
}

function normalizeDuration(durationSeconds) {
  if (typeof durationSeconds !== "number") return null;
  if (Number.isNaN(durationSeconds) || durationSeconds < 0) return null;
  return durationSeconds;
}

async function resolveOwnedTranscriptId({
  transcriptId,
  userId,
  youtubeUrl,
  videoId,
}) {
  if (transcriptId) {
    const owned = await getTranscriptById(transcriptId, {
      includeText: false,
      userId,
    });
    if (owned?.id) return owned.id;
  }

  // Fallback: coba cocokkan berdasarkan videoId atau URL jika ID lama tidak ditemukan.
  const items = await listTranscripts({ userId, limit: 120 });
  const match = items.find((item) => {
    if (transcriptId && item.id === transcriptId) return true;
    if (videoId && item.video_id === videoId) return true;
    if (youtubeUrl && item.youtube_url === youtubeUrl) return true;
    return false;
  });

  return match?.id ?? null;
}

async function ensureTranscriptId({
  transcriptId,
  userId,
  youtubeUrl,
  videoId,
  transcript,
  durationSeconds,
  prompt,
}) {
  const resolvedOwnedId = await resolveOwnedTranscriptId({
    transcriptId,
    userId,
    youtubeUrl,
    videoId,
  });
  if (resolvedOwnedId) return resolvedOwnedId;

  // Jika ID tidak ditemukan (memori kosong/DB kosong), buat ulang agar fitur tetap bisa jalan.
  if (!transcript || transcript.trim().length < 10) return null;
  try {
    const saved = await saveTranscriptResult({
      videoId: videoId ?? null,
      youtubeUrl: youtubeUrl ?? null,
      prompt: prompt ?? "",
      transcriptText: transcript,
      srt: "",
      durationSeconds: durationSeconds ?? null,
      userId,
    });
    return saved?.id ?? null;
  } catch (err) {
    console.warn(
      "[feature-stream] Gagal membuat transcript fallback:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

function sendEvent(controller, event) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function buildPayload(config, result, durationSeconds, transcriptId, account) {
  const base = { [config.key]: result };
  if (config.includeDuration) {
    base.durationSeconds =
      durationSeconds ?? result?.meta?.duration_seconds ?? null;
  }
  if (transcriptId) base.transcriptId = transcriptId;
  if (account) base.account = account;
  return base;
}

function extractCompletionContent(completion) {
  return (
    completion?.choices?.[0]?.message?.content ??
    completion?.choices?.[0]?.delta?.content ??
    ""
  );
}

function streamFromCachedCompletion({
  config,
  content,
  model,
  durationSeconds,
  transcriptId,
  account,
}) {
  const resolvedModel = model ?? "openai-cache";
  const tokens = content.match(/.{1,60}/g) ?? [content];

  const readable = new ReadableStream({
    async start(controller) {
      try {
        tokens.forEach((token) => {
          sendEvent(controller, { type: "token", token });
        });

        const parsed = JSON.parse(content);
        const result = config.extractResult(parsed);
        const payload = buildPayload(
          config,
          result,
          durationSeconds,
          transcriptId,
          account
        );

        if (transcriptId) {
          await updateTranscriptFeatures({
            id: transcriptId,
            [config.key]: result,
            model: resolvedModel,
          });
        }

        sendEvent(controller, {
          type: "done",
          feature: config.key,
          payload: { ...payload, model: resolvedModel },
        });
      } catch (err) {
        sendEvent(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Streaming cache gagal.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function streamFromOpenAI({
  config,
  promptInput,
  transcriptId,
  durationSeconds,
  account,
}) {
  const { systemPrompt, userContent } = config.buildPrompt(promptInput);
  const { key, completion: cachedCompletion } = await getCachedCompletion({
    systemPrompt,
    userContent,
  });

  const cachedContent = cachedCompletion
    ? extractCompletionContent(cachedCompletion)
    : "";
  if (cachedContent) {
    try {
      JSON.parse(cachedContent);
      return streamFromCachedCompletion({
        config,
        content: cachedContent,
        model: cachedCompletion?.model ?? "openai-cache",
        durationSeconds,
        transcriptId,
        account,
      });
    } catch {
      // Cached value korup, abaikan dan lanjutkan ke LLM.
    }
  }

  const { stream, model } = await streamJsonCompletion({
    systemPrompt,
    userContent,
  });

  // Stream token JSON sebagai event NDJSON (token/done/error) agar UI bisa tampil progres sekaligus menyimpan hasil akhir ke cache/DB.
  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        for await (const chunk of stream) {
          const content = chunk?.choices?.[0]?.delta?.content ?? "";
          if (content) {
            buffer += content;
            sendEvent(controller, { type: "token", token: content });
          }
        }

        if (!buffer.trim()) {
          throw new Error("LLM tidak mengirim konten.");
        }

        let parsed;
        try {
          parsed = JSON.parse(buffer);
        } catch (err) {
          throw new Error("LLM gagal menghasilkan JSON streaming.");
        }

        const result = config.extractResult(parsed);
        const payload = buildPayload(
          config,
          result,
          durationSeconds,
          transcriptId,
          account
        );

        if (transcriptId) {
          await updateTranscriptFeatures({
            id: transcriptId,
            [config.key]: result,
            model,
          });
        }

        const completionPayload = {
          choices: [{ message: { content: buffer } }],
          model,
        };
        await setCachedCompletion(key, completionPayload);

        sendEvent(controller, {
          type: "done",
          feature: config.key,
          payload: { ...payload, model },
        });
      } catch (err) {
        sendEvent(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Streaming gagal.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function streamFromStub({ config, stub, durationSeconds, transcriptId, account }) {
  const result = config.extractResult(stub);
  const payload = buildPayload(
    config,
    result,
    durationSeconds,
    transcriptId,
    account
  );
  const model = stub?.model ?? "stub-no-openai-key";
  const jsonString = JSON.stringify(payload[config.key] ?? result ?? {});
  const tokens = jsonString.match(/.{1,60}/g) ?? [jsonString];

  const readable = new ReadableStream({
    async start(controller) {
      try {
        tokens.forEach((token) => {
          sendEvent(controller, { type: "token", token });
        });

        if (transcriptId) {
          await updateTranscriptFeatures({
            id: transcriptId,
            [config.key]: result,
            model,
          });
        }

        sendEvent(controller, {
          type: "done",
          feature: config.key,
          payload: { ...payload, model },
        });
      } catch (err) {
        sendEvent(controller, {
          type: "error",
          message: err instanceof Error ? err.message : "Stub gagal dikirim.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Payload tidak valid." },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const {
    feature,
    transcript,
    prompt = "",
    youtubeUrl,
    videoId,
    transcriptId,
  } = body;
  const rawDurationSeconds = normalizeDuration(body.durationSeconds);
  const config = FEATURE_CONFIG[feature];

  if (!config) {
    return NextResponse.json(
      { error: "Feature tidak dikenal." },
      { status: 400 }
    );
  }

  if (typeof transcript !== "string" || transcript.trim().length < 10) {
    return NextResponse.json(
      { error: "Transcript kosong atau tidak valid." },
      { status: 400 }
    );
  }

  const tokenCost = 2; // Ringkasan, Q&A, mindmap, dan quiz masing-masing butuh 2 token.
  let account = null;
  try {
    consumeUserTokens(session.user.id, tokenCost, {
      email: session.user.email,
      name: session.user.name,
    });
    account = getUserAccount(session.user.id, {
      email: session.user.email,
      name: session.user.name,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Token habis. Langganan Plus, Pro, atau Ultra untuk lanjut.";
    return NextResponse.json({ error: message }, { status: 402 });
  }

  const resolvedDurationSeconds = rawDurationSeconds ?? null;
  const resolvedQuizCount =
    feature === "quiz"
      ? body.quizCount ?? decideQuizCount(resolvedDurationSeconds)
      : undefined;
  const ensuredTranscriptId = await ensureTranscriptId({
    transcriptId,
    userId: session.user.id,
    youtubeUrl,
    videoId,
    transcript,
    durationSeconds: resolvedDurationSeconds,
    prompt,
  });

  const promptInput = {
    videoTitle: resolveVideoTitle(videoId, youtubeUrl),
    prompt,
    transcript,
    durationSeconds: resolvedDurationSeconds,
    quizCount: resolvedQuizCount,
  };

  if (!process.env.OPENAI_API_KEY) {
    const stub = buildStubInsights(transcript, prompt, {
      quizCount: resolvedQuizCount,
      durationSeconds: resolvedDurationSeconds,
    });
    return streamFromStub({
      config,
      stub,
      durationSeconds: resolvedDurationSeconds,
      transcriptId: ensuredTranscriptId,
      account,
    });
  }

  try {
    return await streamFromOpenAI({
      config,
      promptInput,
      transcriptId: ensuredTranscriptId,
      durationSeconds: resolvedDurationSeconds,
      account,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "Streaming gagal dimulai. Periksa konfigurasi OpenAI.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
