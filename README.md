# Irtaqi AI boilerplate

Next.js (App Router) + Tailwind + shadcn-style UI + tRPC + NextAuth + BullMQ queueing, ready for YouTube ingest and Whisper/Hugging Face transcription. Designed to run on Coolify for both frontend and backend.

## Quickstart

```bash
bun install         # install deps
bun dev             # start Next.js dev server
bun run lint        # lint
bun run typecheck   # type-check
bun run worker      # start BullMQ worker (separate terminal)
```

Open http://localhost:3000 to see the starter UI. Mermaid sandbox lives at `/mermaid`.

## Environment

Create `.env.local` with:

```bash
NEXTAUTH_SECRET=your-super-secret-string
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_API_KEY=...
OPENAI_API_KEY=...             # optional (fallback stub used if missing)
INTERNAL_API_TOKEN=dev-internal-token
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API map

- `GET /api/trpc/health.ping` — health check (tRPC).
- `GET /api/youtube?id=<videoId>|url=<youtube-url>` — YouTube metadata stub.
- `POST /api/queue/enqueue` — enqueue transcription `{ videoId|youtubeUrl|audioUrl, prompt }`.
- `POST /api/internal/transcribe` — internal-only (header `x-internal-token`) transcription stub.
- `GET|POST /api/auth/[...nextauth]` — NextAuth (Google).

## Queue + workers

- Queue helper: `src/lib/queue.ts`
- Worker stub: `src/queue/worker.ts` (uses the same Redis connection).
- Jobs have retries and exponential backoff; swap the stub with real Whisper/HF logic in `src/lib/openai.ts`.

## UI + diagrams

- Tailwind + shadcn-style Button/Card primitives in `src/components/ui`.
- Status panel demonstrating NextAuth + tRPC at `src/components/status-panel.tsx`.
- Mermaid viewer in `src/components/mermaid-viewer.tsx`; sample page at `/mermaid`.

## Notes for Coolify

- Build command: `bun install && bun run build`
- Start command: `bun run start`
- Worker process: `bun run src/queue/worker.ts`
- Provide `.env` with the variables above; include Redis service for BullMQ.
