"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

export function MindmapCanvas({ chart, title = "Peta Pikiran" }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "dark",
      themeVariables: {
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        primaryColor: "#1b1145",
        secondaryColor: "#312e81",
        tertiaryColor: "#4c1d95",
        primaryBorderColor: "#8b5cf6",
        lineColor: "#c084fc",
        textColor: "#e5e7eb",
      },
    });
  }, []);

  useEffect(() => {
    if (!chart) return;
    let active = true;
    setError("");

    const render = async () => {
      try {
        const { svg } = await mermaid.render(`${id}-mindmap`, chart);
        if (!active) return;

        const svgLower = svg?.toLowerCase?.() ?? "";
        const hasSyntaxError =
          svgLower.includes("syntax error") ||
          svgLower.includes("parse error") ||
          svgLower.includes("mermaid version");

        if (hasSyntaxError) {
          setError("Mind map tidak valid untuk dirender. Periksa struktur node.");
          setSvg("");
          return;
        }

        setSvg(svg);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal merender mindmap");
        setSvg("");
      }
    };

    render();

    return () => {
      active = false;
    };
  }, [chart, id]);

  if (!chart) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {error ? <span className="text-xs text-amber-300">Render gagal</span> : null}
      </div>
      {error ? (
        <p className="text-sm text-amber-200">{error}</p>
      ) : (
        <div
          className="mermaid [&>svg]:mx-auto [&>svg]:h-full [&>svg]:w-full [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
