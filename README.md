# Irtaqi AI boilerplate

Next.js (App Router) + Tailwind + shadcn-style UI + NextAuth + BullMQ queueing, ready for YouTube ingest and Whisper/Hugging Face transcription. Designed to run on Coolify for both frontend and backend.

## Quickstart

```bash
bun install         # install deps
bun dev             # start Next.js dev server
bun run lint        # lint
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
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
WHISPER_API_KEY=...            # for whisperapi.com
```

## Server actions (no custom API routes)

- `enqueueTranscriptionAction` — enqueue transcription `{ videoId|youtubeUrl|audioUrl, prompt }`.
- `transcribeDirectAction` — server-side transcription (WhisperAPI or stub).
- `healthCheck` / `healthSecret` — public/protected health ping.
- `signupAction` — create user in in-memory store.
- `fetchYoutubeMetaAction` / `ytdlpInfoAction` — YouTube metadata and yt-dlp JSON wrapper.
- `GET|POST /api/auth/[...nextauth]` — NextAuth (Google) still uses the built-in route.

## Queue + workers

- Queue helper: `src/lib/queue.js`
- Worker stub: `src/queue/worker.js` (uses the same Redis connection).
- Jobs have retries and exponential backoff; swap the stub with real Whisper/HF logic in `src/lib/openai.js`.

## UI + diagrams

- Tailwind + shadcn-style Button/Card primitives in `src/components/ui`.
- Status panel demonstrating NextAuth + server actions at `src/components/status-panel.jsx`.
- Mermaid viewer in `src/components/mermaid-viewer.jsx`; sample page at `/mermaid`.

## Deployment (IDcloudhost + Cloudflare)

- **Backend (VPS on IDcloudhost)**  
  - Build: `bun install && bun run build`  
  - Start: `bun run start` (or `pm2 start bun -- run start`)  
  - Worker: run separately `bun run src/queue/worker.js` (ensure Redis reachable).  
  - Expose `PORT` (default 3000) and set all `.env` values on the VPS, including `REDIS_URL`.

- **Frontend (Cloudflare Pages)**  
  - Framework preset: Next.js.  
  - Build command: `bun install && bun run build`  
  - Output directory: `.next` (Cloudflare handles).  
  - Set `NEXT_PUBLIC_APP_URL` to your Pages domain and point `NEXTAUTH_URL` to the backend URL on the VPS.

- **Redis / queue**  
  - Use IDcloudhost-managed Redis or a container on the VPS; set `REDIS_URL` for both app and worker.  
  - Keep `INTERNAL_API_TOKEN` secret; only workers/internal callers should use it.
