const TIMESTAMP_PATTERNS = [
  /<\/?c[^>]*>/gi,
  /<\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?>/g,
  /\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s+-->\s+\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}/g,
  /\[\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\]/g,
  /\(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\)/g,
];

const NOISE_TOKEN_PATTERNS = [
  /^(?:\.{2,}|…+)$/,
  /^(?:-+|—+|–+)$/,
  /^(?:•+|▪+|·+|●+)$/,
  /^(?:♪+)$/,
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

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 50;
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 16;
const PDF_USABLE_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

// Glyph widths for Helvetica in PDF font units (per 1000).
const HELVETICA_WIDTHS = {
  " ": 278,
  "!": 278,
  '"': 355,
  "#": 556,
  $: 556,
  "%": 889,
  "&": 722,
  "'": 191,
  "(": 333,
  ")": 333,
  "*": 389,
  "+": 584,
  ",": 278,
  "-": 333,
  ".": 278,
  "/": 278,
  0: 556,
  1: 556,
  2: 556,
  3: 556,
  4: 556,
  5: 556,
  6: 556,
  7: 556,
  8: 556,
  9: 556,
  ":": 278,
  ";": 278,
  "<": 584,
  "=": 584,
  ">": 584,
  "?": 556,
  "@": 1015,
  A: 722,
  B: 667,
  C: 667,
  D: 722,
  E: 611,
  F: 556,
  G: 722,
  H: 722,
  I: 333,
  J: 389,
  K: 722,
  L: 611,
  M: 889,
  N: 722,
  O: 722,
  P: 556,
  Q: 722,
  R: 667,
  S: 556,
  T: 611,
  U: 722,
  V: 722,
  W: 944,
  X: 722,
  Y: 722,
  Z: 611,
  "[": 333,
  "\\": 278,
  "]": 333,
  "^": 469,
  _: 556,
  "`": 333,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  "{": 389,
  "|": 280,
  "}": 389,
  "~": 584,
};

export function cleanTranscriptText(text) {
  if (!text) return "";
  let result = text;
  for (const pattern of TIMESTAMP_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  // Buang token kosong seperti deretan titik/garis/bullet
  result = result
    .replace(/\s+(?:\.{2,}|…+)(?:\s+(?:\.{2,}|…+))+/g, " ")
    .replace(/(?:^|\s)(?:\.{2,}|…+)(?=\s|$)/g, " ");

  const tokens = result
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NOISE_TOKEN_PATTERNS.some((re) => re.test(token)));

  result = tokens.join(" ");
  return result.replace(/\s+/g, " ").trim();
}

function measureHelveticaText(text, fontSize = PDF_FONT_SIZE) {
  const size = fontSize || PDF_FONT_SIZE;
  let units = 0;

  for (const char of text || "") {
    units += HELVETICA_WIDTHS[char] ?? 600;
  }

  return (units / 1000) * size;
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
        `<p style="font-size:14px;line-height:1.6;margin:0 0 12px 0;text-align:justify;text-justify:inter-word;">${escapeHtml(p)}</p>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
</head>
<body style="font-family:Arial, sans-serif; color:#111; padding:24px; max-width:800px; text-align:justify; text-justify:inter-word;">
  <h1 style="margin:0 0 16px 0; font-size:22px; text-align:left;">${safeTitle}</h1>
  ${body}
</body>
</html>`;

  return Buffer.from(html, "utf8");
}

function wrapText(text, maxWidth = PDF_USABLE_WIDTH, fontSize = PDF_FONT_SIZE) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const nextWidth = measureHelveticaText(next, fontSize);
    if (nextWidth > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [text || ""];
}

function buildPdfContentLines({
  title,
  paragraphs,
  fontSize = PDF_FONT_SIZE,
  maxWidth = PDF_USABLE_WIDTH,
}) {
  const lines = [];

  const addWrappedBlock = (text, { justify = true } = {}) => {
    const wrapped = wrapText(text, maxWidth, fontSize);
    if (!wrapped.length) return;
    wrapped.forEach((line, idx) => {
      lines.push({
        text: line,
        isParagraphEnd: idx === wrapped.length - 1,
        canJustify: justify,
      });
    });
    lines.push({ text: "", isParagraphEnd: true, canJustify: false });
  };

  if (title) addWrappedBlock(title, { justify: false });

  for (const paragraph of paragraphs || []) {
    addWrappedBlock(paragraph, { justify: true });
  }

  if (!lines.length) {
    lines.push({ text: "Transcript kosong.", isParagraphEnd: true, canJustify: false });
  }

  if (lines.length && lines[lines.length - 1].text === "") {
    lines.pop();
  }

  return lines;
}

export function buildPdfDocument({ title, paragraphs }) {
  const lines = buildPdfContentLines({
    title: title || "Transcript",
    paragraphs,
  });

  const contentOps = [
    "BT",
    `/F1 ${PDF_FONT_SIZE} Tf`,
    `${PDF_LINE_HEIGHT} TL`,
    `${PDF_MARGIN} ${PDF_PAGE_HEIGHT - PDF_MARGIN} Td`,
    "0 Tw",
  ];

  lines.forEach((line, idx) => {
    if (idx > 0) {
      contentOps.push("T*");
      if (line.text === "") {
        contentOps.push("T*");
        return;
      }
    }

    if (line.text === "") {
      return;
    }

    const words = line.text.trim().split(/\s+/);
    const spaceCount = Math.max(words.length - 1, 0);
    const textWidth = measureHelveticaText(line.text, PDF_FONT_SIZE);
    const availableWidth = Math.max(PDF_USABLE_WIDTH - textWidth, 0);
    const shouldJustify =
      line.canJustify && !line.isParagraphEnd && spaceCount > 0 && availableWidth > 0;

    if (shouldJustify) {
      const spacing = availableWidth / spaceCount;
      contentOps.push(`${spacing.toFixed(3)} Tw`);
    } else {
      contentOps.push("0 Tw");
    }

    contentOps.push(`(${escapePdfString(line.text)}) Tj`);

    if (shouldJustify) {
      contentOps.push("0 Tw");
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
