"use client";

import mermaid from "mermaid";
import { useAtom } from "jotai";
import { useEffect, useId } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mermaidSvgAtom } from "@/state/mermaid-atoms";

export function MermaidViewer({ title = "Flow", chart }) {
  const [svg, setSvg] = useAtom(mermaidSvgAtom);
  const id = useId();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "neutral",
    });

    const renderDiagram = async () => {
      const { svg } = await mermaid.render(`${id}-diagram`, chart);
      setSvg(svg);
    };

    renderDiagram().catch((error) => {
      console.error("Failed to render mermaid diagram", error);
      setSvg(`<pre class="text-red-500">${error instanceof Error ? error.message : "Failed to render diagram"}</pre>`);
    });
  }, [chart, id]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="mermaid [&>svg]:mx-auto [&>svg]:h-full [&>svg]:w-full [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </CardContent>
    </Card>
  );
}
