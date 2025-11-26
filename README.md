# Irtaqi AI boilerplate

Next.js (App Router) + Tailwind + shadcn-style UI + NextAuth dengan alur server action langsung (YouTube transcript → LLM ringkasan/Q&A/mindmap → Postgres). Tidak ada queue/Redis/worker terpisah.

## Quickstart

```bash
bun install         # install deps
bun dev             # start Next.js dev server
bun run lint        # lint
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
POSTGRES_URL=postgres://user:pass@host:5432/dbname
# POSTGRES_SSL=true            # set true jika butuh SSL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Server actions (no custom API routes)

- `processYoutubeTranscriptionAction` — ambil transcript/SRT, panggil LLM (ringkas/Q&A/mindmap), simpan ke Postgres.
- `transcribeDirectAction` — server-side transcription stub untuk audio URL.
- `healthCheck` / `healthSecret` — public/protected health ping.
- `signupAction` — create user in in-memory store.
- `fetchYoutubeMetaAction` / `ytdlpInfoAction` — YouTube metadata and yt-dlp JSON wrapper.
- `GET|POST /api/auth/[...nextauth]` — NextAuth (Google) still uses the built-in route.

## Transcript + LLM pipeline

- URL YouTube dikirim dari frontend via server action/API.
- Server mengambil transcript/SRT, kirim ke LLM untuk ringkasan, Q&A, dan mindmap JSON.
- Hasil dan transcript disimpan ke Postgres, lalu dikirim balik ke frontend tanpa antrean.

## UI + diagrams

- Tailwind + shadcn-style Button/Card primitives in `src/components/ui`.
- Status panel demonstrating NextAuth + server actions at `src/components/status-panel.jsx`.
- Mermaid viewer in `src/components/mermaid-viewer.jsx`; sample page at `/mermaid`.

## Deployment (IDcloudhost + Cloudflare)

- **Backend (VPS on IDcloudhost)**  
  - Build: `bun install && bun run build`  
  - Start: `bun run start` (or `pm2 start bun -- run start`)  
  - Expose `PORT` (default 3000) and set `.env` values termasuk `POSTGRES_URL`.

- **Frontend (Cloudflare Pages)**  
  - Framework preset: Next.js.  
  - Build command: `bun install && bun run build`  
  - Output directory: `.next` (Cloudflare handles).  
  - Set `NEXT_PUBLIC_APP_URL` to your Pages domain and point `NEXTAUTH_URL` to the backend URL on the VPS.
