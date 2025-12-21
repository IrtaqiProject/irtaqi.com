export function sanitizeText(value, fallback = "") {
  const collapsed = (value ?? "")
    .toString()
    .replace(/\s+/g, " ")
    .trim();

  // Hapus tanda kurung/bracket yang diperlakukan Mermaid sebagai token bentuk.
  const safeChars = collapsed
    .replace(/["<>()\[\]{}]/g, "")
    .trim();

  // Mermaids mindmap parser gagal bila label diawali bullet (-, *, •, angka).
  const withoutBullets = safeChars
    .replace(/^[\-\u2013\u2014\u2022\u2023\u25E6\u2043\*\+•●○◦·]+\s*/, "")
    .replace(/^\d+[\.\)\:]\s*/, "")
    .trim();

  return (withoutBullets || safeChars || fallback).trim();
}

export function buildMindmapChart(nodes = [], title = "Peta Pikiran") {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  const map = new Map();
  nodes.forEach((node, idx) => {
    const key = node?.id ?? `node_${idx}`;
    map.set(key, {
      label: sanitizeText(node?.label ?? node?.title, `Node ${idx + 1}`),
      children: Array.isArray(node?.children) ? node.children.filter(Boolean) : [],
      note: sanitizeText(node?.note),
    });
  });

  for (const node of map.values()) {
    for (const child of node.children) {
      if (!map.has(child)) {
        map.set(child, {
          label: sanitizeText(child, "Subtopik"),
          children: [],
          note: "",
        });
      }
    }
  }

  const keys = Array.from(map.keys());
  const referenced = new Set();
  map.forEach((node) => node.children.forEach((child) => referenced.add(child)));

  // Pilih akar yang konsisten (n1/root atau node yang tidak pernah direferensikan) supaya struktur tetap utuh walau data kurang rapi.
  let rootKey = null;
  if (map.has("n1")) {
    rootKey = "n1";
  } else if (map.has("root")) {
    rootKey = "root";
  } else {
    rootKey = keys.find((key) => !referenced.has(key)) ?? keys[0];
  }

  if (!rootKey) return null;

  const rootNode = map.get(rootKey);
  if (rootNode) {
    rootNode.label = sanitizeText(title, rootNode.label || "Peta Pikiran");
  }

  const lines = ["mindmap"];
  const visited = new Set();

  // DFS ringan untuk merangkai node tanpa menimbulkan siklus bila input berantakan.
  const walk = (key, depth) => {
    if (visited.has(key)) return;
    visited.add(key);
    const node = map.get(key);
    if (!node) return;
    const note = node.note ? ` — ${node.note}` : "";
    const line = `${"  ".repeat(depth)}${node.label}${note}`;
    lines.push(line);
    node.children.forEach((childKey) => walk(childKey, depth + 1));
  };

  walk(rootKey, 1);

  map.forEach((node, key) => {
    if (visited.has(key)) return;
    lines.push(`  ${node.label}`);
  });

  return lines.join("\n");
}
