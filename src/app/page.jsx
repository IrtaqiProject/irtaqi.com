import Link from "next/link";

import { MermaidViewer } from "@/components/mermaid-viewer";
import { StatusPanel } from "@/components/status-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pipelineDiagram = `
flowchart LR
  A[YouTube video/audio] -->|fetch via Data API| B(Next API /api/youtube)
  B --> C{Queue}
  C -->|BullMQ| D[Worker / internal transcribe]
  D -->|Whisper/OpenAI| E[Transcript + metadata]
  E -->|tRPC| F[React UI]
  F -->|Mermaid| G[Mindmap/diagram]
  F -->|NextAuth| H[Google login]
`;

const featureCards = [
  {
    title: "Auth + tRPC",
    description: "NextAuth (Google) wired to tRPC with protected procedures for signed-in flows.",
    items: ["App Router API routes", "Session-aware tRPC context", "Client hooks ready"],
  },
  {
    title: "Media ingest",
    description: "YouTube Data API stub with videoId/url parsing so you can pull streams on-demand.",
    items: ["GET /api/youtube?id=", "URL -> videoId helper", "Ready for direct asset access"],
  },
  {
    title: "Speech-to-text",
    description: "Internal transcribe endpoint prepared for Whisper/OpenAI, pluggable for Hugging Face.",
    items: ["POST /api/internal/transcribe", "OpenAI client helper", "Safe fallback when no key"],
  },
  {
    title: "Queue service",
    description: "BullMQ queue + Redis connection helper so heavy jobs run off the web thread.",
    items: ["Queue + worker stub", "ENV-driven Redis URL", "Backoff + retries configured"],
  },
  {
    title: "Diagramming",
    description: "Mermaid viewer component + sample page to visualize transcripts or flows.",
    items: ["Client-only rendering", "Secure (loose) mode", "Themeable via Tailwind"],
  },
  {
    title: "UI kit",
    description: "Tailwind + shadcn-style primitives (Button, Card, badge styles) to move fast.",
    items: ["Tokenized color system", "Gradient CTA buttons", "Responsive layout utilities"],
  },
];

export default function Home() {
  return (
    <main className="container space-y-12 py-14">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary" />
            AI media & diagram boilerplate
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Ship YouTube-to-text experiences with queues, tRPC, and shadcn UI.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Next.js (App Router) + Tailwind + BullMQ + tRPC + NextAuth + Mermaid. The wiring for
            ingesting YouTube audio, queuing Whisper jobs, and drawing diagrams is already in place.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/mermaid">Open diagram sandbox</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="https://trpc.io/docs" target="_blank" rel="noreferrer">
                tRPC docs
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="https://next-auth.js.org/getting-started/introduction" target="_blank" rel="noreferrer">
                NextAuth guide
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Stack", value: "Next 16 + tRPC 10 + Tailwind" },
              { label: "AI hooks", value: "OpenAI/Whisper-ready" },
              { label: "Deployment", value: "Coolify friendly" },
            ].map((item) => (
              <Card key={item.label} className="border-dashed border-primary/30 bg-card/60">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <StatusPanel />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Services</p>
            <h2 className="text-2xl font-bold tracking-tight">What&apos;s wired in</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/api/trpc/health.ping" target="_blank" rel="noreferrer">
              Check tRPC endpoint
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {card.items.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold tracking-tight">Pipeline preview</h2>
          <p className="text-muted-foreground">
            Visualize how the YouTube fetcher, BullMQ queue, internal transcriber, and UI fit
            together. Swap the nodes to match your own services or Hugging Face models.
          </p>
          <MermaidViewer chart={pipelineDiagram} title="YouTube → Queue → Whisper → UI" />
        </div>
        <Card className="flex flex-col justify-between overflow-hidden bg-gradient-to-b from-foreground to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Developer notes</CardTitle>
            <CardDescription className="text-white/80">
              Shortcuts for working locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/80">
            <p>
              - Run <code className="font-semibold text-white">bun install</code> then{" "}
              <code className="font-semibold text-white">bun dev</code>.
            </p>
            <p>
              - Set env vars in <code className="font-semibold text-white">.env.local</code> (see
              README).
            </p>
            <p>
              - Worker stub lives in <code className="font-semibold text-white">src/queue/worker.js</code>.
            </p>
            <p className="text-white">Happy shipping 🚀</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
