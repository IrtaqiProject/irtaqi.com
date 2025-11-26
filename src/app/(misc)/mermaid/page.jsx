import { MermaidViewer } from "@/components/mermaid-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sample = `
sequenceDiagram
  autonumber
  participant U as User
  participant N as Next.js Server Action
  participant Y as YouTube Transcript/SRT
  participant L as LLM
  participant P as Postgres
  U->>N: Submit YouTube URL + prompt
  N->>Y: Fetch transcript / SRT
  Y-->>N: Transcript text
  N->>L: Ringkasan + Q&A + mindmap
  L-->>N: JSON hasil
  N->>P: Simpan transcript + hasil
  P-->>N: Record ID + timestamp
  N-->>U: Kirim hasil ke frontend
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

      <MermaidViewer chart={sample} title="Server action flow" />

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Drop into any client component.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl bg-muted/60 p-4 text-sm text-foreground">
            <code>{`import { MermaidViewer } from "@/components/mermaid-viewer";

const chart = \`graph TD
  A[User URL] --> B[Server Action]
  B --> C[YouTube Transcript]
  C --> D[LLM Summary/Q&A]
  D --> E[Postgres]
  E --> F[Client UI]
\`;

<MermaidViewer chart={chart} title="My flow" />`}</code>
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
