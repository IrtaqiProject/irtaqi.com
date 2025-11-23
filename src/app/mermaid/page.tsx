import { MermaidViewer } from "@/components/mermaid-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sample = `
sequenceDiagram
  autonumber
  participant U as User
  participant N as Next.js API
  participant Q as BullMQ
  participant W as Worker
  participant O as OpenAI Whisper
  U->>N: POST /api/queue/enqueue (videoId)
  N->>Q: Add job (transcription)
  Q-->>W: Pull job
  W->>O: Transcribe audio
  O-->>W: Transcript text
  W->>N: Callback via /api/internal/transcribe
  N-->>U: tRPC subscription/poll update
`;

export default function MermaidPage() {
  return (
    <main className="container space-y-10 py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">Diagram sandbox</p>
          <h1 className="text-3xl font-bold tracking-tight">Mermaid ready to drop in</h1>
          <p className="max-w-2xl text-muted-foreground">
            Use Mermaid diagrams to visualize transcription flows, playlists, or knowledge graphs.
            Swap the <code>chart</code> prop with your own definition.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank" rel="noreferrer">
            Mermaid syntax
          </a>
        </Button>
      </div>

      <MermaidViewer chart={sample} title="Queue + Whisper flow" />

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Drop into any client component.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl bg-muted/60 p-4 text-sm text-foreground">
            <code>{`import { MermaidViewer } from "@/components/mermaid-viewer";

const chart = \`graph TD
  A[YouTube] -->|Data API| B(Download)
  B --> C[Queue]
  C --> D[Whisper]
  D --> E[tRPC client]
\`;

<MermaidViewer chart={chart} title="My flow" />`}</code>
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
