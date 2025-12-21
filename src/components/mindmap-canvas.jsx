"use client";

import { useEffect, useRef, useState } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

const palette = [
  "#2563eb",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];

export function MindmapCanvas({ chart, title = "Peta Pikiran" }) {
  const svgRef = useRef(null);
  const markmapRef = useRef(null);
  const transformerRef = useRef(null);
  const [error, setError] = useState("");

  if (!transformerRef.current) {
    transformerRef.current = new Transformer();
  }

  useEffect(() => {
    const normalized = chart?.trim();
    if (!normalized || !svgRef.current) return;

    let cancelled = false;
    setError("");

    const render = async () => {
      try {
        const svgEl = svgRef.current;
        svgEl.style.setProperty("--markmap-font", "600 15px/22px 'Inter', system-ui, sans-serif");
        svgEl.style.setProperty("--markmap-text-color", "#0f172a");
        svgEl.style.setProperty("--markmap-code-bg", "#f8fafc");
        svgEl.style.setProperty("--markmap-code-color", "#0f172a");
        svgEl.style.setProperty("--markmap-a-color", "#2563eb");
        svgEl.style.setProperty("--markmap-a-hover-color", "#1d4ed8");
        svgEl.style.setProperty("--markmap-highlight-node-bg", "#e0f2fe");
        svgEl.style.setProperty("--markmap-circle-open-bg", "#e2e8f0");

        const { root } = transformerRef.current.transform(normalized);

        if (!root || (!root.children?.length && !root.content)) {
          throw new Error("Mindmap kosong atau tidak valid.");
        }

        const paintLinks = () => {
          const links = svgEl.querySelectorAll("path.markmap-link");
          links.forEach((link) => {
            const depth = Number(link.dataset.depth ?? 0);
            const stroke = palette[Number.isFinite(depth) ? depth % palette.length : 0];
            link.setAttribute("stroke", stroke);
            link.setAttribute("stroke-width", "2.4");
            link.setAttribute("opacity", "0.9");
          });
        };

        if (markmapRef.current && markmapRef.current.setData) {
          await markmapRef.current.setData(root);
          if (markmapRef.current.fit) {
            await markmapRef.current.fit();
          }
          paintLinks();
        } else {
          markmapRef.current?.destroy?.();
          svgEl.innerHTML = "";
          markmapRef.current = Markmap.create(
            svgEl,
            {
              color: (node) => palette[node.depth % palette.length],
              lineWidth: (node) => Math.max(1.6, 2.6 - node.depth * 0.2),
              duration: 300,
              initialExpandLevel: 3,
            },
            root,
          );
          if (markmapRef.current.fit) {
            await markmapRef.current.fit();
          }
          paintLinks();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal merender mindmap");
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  useEffect(() => {
    return () => {
      if (markmapRef.current?.destroy) {
        markmapRef.current.destroy();
      }
      markmapRef.current = null;
    };
  }, []);

  if (!chart) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50 to-amber-50 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {error ? <span className="text-xs text-amber-600">Render gagal</span> : null}
      </div>
      {error ? (
        <p className="text-sm text-amber-700">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-rose-50 p-2 shadow-inner">
          <svg ref={svgRef} className="h-[420px] w-full text-slate-900" />
        </div>
      )}
    </div>
  );
}
