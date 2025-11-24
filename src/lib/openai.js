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

export async function transcribeWithWhisperAPI(audioUrl, { prompt, language = "id", responseFormat = "json" } = {}) {
  if (!process.env.WHISPER_API_KEY) {
    throw new Error("WHISPER_API_KEY is missing. Add it to .env.local.");
  }

  const res = await fetch("https://api.whisperapi.com/whisper", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHISPER_API_KEY}`,
    },
    body: JSON.stringify({
      fileurl: audioUrl,
      prompt,
      language,
      response_format: responseFormat,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`WhisperAPI error ${res.status}: ${message}`);
  }

  return res.json();
}
