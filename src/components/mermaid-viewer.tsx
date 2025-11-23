"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MermaidViewerProps = {
  title?: string;
  chart: string;
};

export function MermaidViewer({ title = "Flow", chart }: MermaidViewerProps) {
  const [svg, setSvg] = useState<string>("");
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
