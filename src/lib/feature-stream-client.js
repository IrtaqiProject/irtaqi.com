export async function streamFeature(feature, payload = {}, { onToken } = {}) {
  const response = await fetch("/api/feature-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature, ...payload }),
    cache: "no-store",
  });

  if (!response.ok) {
    const fallbackMessage = "Gagal memulai streaming.";
    const rawText = (await response.text().catch(() => "")) || "";
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        throw new Error(parsed?.error || fallbackMessage);
      } catch {
        throw new Error(rawText || fallbackMessage);
      }
    }
    throw new Error(fallbackMessage);
  }

  if (!response.body) {
    throw new Error("Stream tidak tersedia.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload = null;

  const processEventLine = (line) => {
    if (!line.trim()) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    switch (event?.type) {
      case "token":
        if (event.token) {
          onToken?.(event.token);
        }
        break;
      case "done":
        finalPayload = event.payload ?? null;
        break;
      case "error":
        throw new Error(event.message ?? "Streaming gagal.");
      default:
        break;
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processEventLine(line);
    }
  }

  if (buffer.trim()) {
    processEventLine(buffer);
  }

  if (!finalPayload) {
    throw new Error("Streaming selesai tanpa data.");
  }

  return finalPayload;
}
