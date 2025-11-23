import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (cachedClient) return cachedClient;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local.");
  }
  cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

export async function transcribeAudioStub(source: string, prompt?: string) {
  // Placeholder to avoid network calls during development.
  return {
    text: `Transcription placeholder for "${source}"${prompt ? ` with prompt "${prompt}"` : ""}.`,
  };
}
