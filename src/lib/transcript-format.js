const TIMESTAMP_PATTERNS = [
  /<\/?c[^>]*>/gi,
  /<\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?>/g,
  /\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s+-->\s+\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}/g,
  /\[\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\]/g,
  /\(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\)/g,
];

function escapeHtml(input) {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapePdfString(input) {
  return (input || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

export function cleanTranscriptText(text) {
  if (!text) return "";
  let result = text;
  for (const pattern of TIMESTAMP_PATTERNS) {
    result = result.replace(pattern, " ");
  }
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

export function splitTranscriptIntoParagraphs(
  text,
  { sentencesPerParagraph = 4, maxParagraphLength = 700 } = {},
) {
  const cleaned = cleanTranscriptText(text);
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const paragraphs = [];
  let bucket = [];

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    bucket.push(sentence);
    const joined = bucket.join(" ");
    if (
      bucket.length >= sentencesPerParagraph ||
      joined.length >= maxParagraphLength
    ) {
      paragraphs.push(joined);
      bucket = [];
    }
  }

  if (bucket.length) {
    paragraphs.push(bucket.join(" "));
  }

  if (!paragraphs.length) {
    paragraphs.push(cleaned);
  }

  return paragraphs.map((p) => p.trim()).filter(Boolean);
}

export function buildWordDocument({ title, paragraphs }) {
  const safeTitle = escapeHtml(title || "Transcript");
  const body = (paragraphs || [])
    .map(
      (p) =>
        `<p style="font-size:14px;line-height:1.6;margin:0 0 12px 0;">${escapeHtml(p)}</p>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
</head>
<body style="font-family:Arial, sans-serif; color:#111; padding:24px; max-width:800px;">
  <h1 style="margin:0 0 16px 0; font-size:22px;">${safeTitle}</h1>
  ${body}
</body>
</html>`;

  return Buffer.from(html, "utf8");
}

function wrapText(text, maxWidth = 90) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [text || ""];
}

function buildPdfContentLines({ title, paragraphs }) {
  const lines = [];
  if (title) {
    lines.push(title);
    lines.push("");
  }

  for (const paragraph of paragraphs || []) {
    const wrapped = wrapText(paragraph, 90);
    lines.push(...wrapped, "");
  }

  if (!lines.length) lines.push("Transcript kosong.");
  return lines;
}

export function buildPdfDocument({ title, paragraphs }) {
  const lines = buildPdfContentLines({
    title: title || "Transcript",
    paragraphs,
  });

  const leading = 16;
  const contentOps = ["BT", "/F1 12 Tf", `${leading} TL`, "50 760 Td"];

  lines.forEach((line, idx) => {
    if (idx > 0) {
      contentOps.push("T*");
      if (line === "") contentOps.push("T*");
    }
    if (line !== "") {
      contentOps.push(`(${escapePdfString(line)}) Tj`);
    }
  });

  contentOps.push("ET");

  const contentStream = contentOps.join("\n");
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const objects = [];
  const offsets = [0];
  const chunks = ["%PDF-1.4\n"];

  const appendObject = (body) => {
    const index = offsets.length;
    const offset = Buffer.byteLength(chunks.join(""), "utf8");
    offsets.push(offset);
    chunks.push(`${index} 0 obj\n${body}\nendobj\n`);
    objects.push(index);
  };

  appendObject("<< /Type /Catalog /Pages 2 0 R >>");
  appendObject("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  appendObject(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  );
  appendObject(`<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream`);
  appendObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  const pad = (num) => String(num).padStart(10, "0");

  const xrefLines = ["xref", `0 ${offsets.length}`, "0000000000 65535 f "];
  offsets.slice(1).forEach((off) => {
    xrefLines.push(`${pad(off)} 00000 n `);
  });

  const trailer = [
    "trailer",
    `<< /Size ${offsets.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  chunks.push(`${xrefLines.join("\n")}\n${trailer}\n`);
  return Buffer.from(chunks.join(""), "utf8");
}
