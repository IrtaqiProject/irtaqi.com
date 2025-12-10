import { NextResponse } from "next/server";

import { updateTranscriptFeatures } from "@/lib/db";
import { getCachedCompletion, setCachedCompletion } from "@/lib/llm-cache";
import {
  buildMindmapPrompt,
  buildQaPrompt,
  buildQuizPrompt,
  buildStubInsights,
  buildSummaryPrompt,
  streamJsonCompletion,
} from "@/lib/openai";

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

function sendEvent(controller, event) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function buildPayload(config, result, durationSeconds) {
  const base = { [config.key]: result };
  if (config.includeDuration) {
    base.durationSeconds =
      durationSeconds ?? result?.meta?.duration_seconds ?? null;
  }
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
        const payload = buildPayload(config, result, durationSeconds);

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
      });
    } catch {
      // Cached value korup, abaikan dan lanjutkan ke LLM.
    }
  }

  const { stream, model } = await streamJsonCompletion({
    systemPrompt,
    userContent,
  });

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
        const payload = buildPayload(config, result, durationSeconds);

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

function streamFromStub({ config, stub, durationSeconds, transcriptId }) {
  const result = config.extractResult(stub);
  const payload = buildPayload(config, result, durationSeconds);
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

  const resolvedDurationSeconds = rawDurationSeconds ?? null;
  const resolvedQuizCount =
    feature === "quiz"
      ? body.quizCount ?? decideQuizCount(resolvedDurationSeconds)
      : undefined;

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
      transcriptId,
    });
  }

  try {
    return await streamFromOpenAI({
      config,
      promptInput,
      transcriptId,
      durationSeconds: resolvedDurationSeconds,
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
