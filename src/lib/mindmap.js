export function sanitizeText(value, fallback = "") {
  const clean = (value ?? "").toString().replace(/\s+/g, " ").replace(/["<>]/g, "").trim();
  return clean || fallback;
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
