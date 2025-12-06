# Irtaqi AI Boilerplate — Copilot Instructions

## Architecture Overview

**Stack:** Next.js 16 (App Router) + React 19 + Tailwind + NextAuth (JWT) + Jotai (state) + Postgres + OpenAI API

**Core Pattern:** Single-threaded server actions pipeline (no Redis/queues). YouTube transcript → LLM processing (summary/Q&A/mindmap/quiz) → Postgres storage → immediate frontend response.

### Key Components

- **Server Actions** (`src/actions/`): All business logic runs server-side with `"use server"`. No custom API routes except NextAuth.
- **Frontend State** (`src/state/*.js`): Jotai atoms for reactive UI (loading, error, results). All atoms are declared upfront.
- **Database** (`src/lib/db.js`): PG pool with graceful fallback to in-memory store if `POSTGRES_URL` missing. Uses `nanoid` for IDs.
- **Auth** (`src/lib/auth.js`): NextAuth with Google OAuth + email/password (credentials stored in-memory with bcrypt).
- **UI** (`src/components/ui/`): Shadcn-style Button/Card primitives; global gradient layout via `StepLayout` component.

### Routing (App Router)

```
src/app/
├── (api)/ → NextAuth routes only (no custom endpoints)
├── (app)/ → Protected routes: transcribe, summary, qa, mindmap, quiz
├── (auth)/ → login, signup (unprotected)
├── (marketing)/ → public landing page
└── (misc)/ → health checks, mermaid sandbox
```

Route groups are cosmetic; real protection via NextAuth session checks in server actions.

## Development Workflows

### Setup & Build

```bash
# Install
bun install

# Dev server (watches next.config, .env changes)
bun dev

# Production build
bun build && bun start

# Lint
bun lint

# Database migration (run once after .env POSTGRES_URL is set)
bun run migrate
```

### Database Initialization

Migrations are SQL files in `migrations/` directory. Run `bun run migrate` (calls `scripts/migrate.js`) to execute them sequentially. Tables: `transcripts` (main), plus `_prisma_migrations` if Prisma used later.

### Environment Variables

Required in `.env.local`:

```
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_API_KEY=...
OPENAI_API_KEY=...  # optional; stubs used if missing
POSTGRES_URL=postgres://user:pass@host:5432/db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `POSTGRES_URL` is missing, the app falls back to in-memory storage (`globalThis._memoryTranscriptStore`).

## Patterns & Conventions

### Server Actions (src/actions/)

All async business logic. Signature pattern:

```javascript
"use server";
import { z } from "zod";

export async function actionNameAction(input) {
  const parsed = actionSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("validation failed");
  // DB/LLM logic
  return result;
}
```

**Key actions:**

- `processYoutubeTranscriptionAction(youtubeUrl)` → saves raw transcript, returns metadata
- `generateSummaryAction`, `generateQaAction`, `generateMindmapAction`, `generateQuizAction` → call LLM, update DB
- `fetchYoutubeMetaAction`, `ytdlpInfoAction` → YouTube metadata extraction
- `signupAction`, `healthCheck`, `healthSecret` → auth & monitoring

### Jotai State (src/state/)

Declare atoms upfront, one per concern:

```javascript
// transcribe-atoms.js
export const youtubeAtom = atom("");
export const loadingAtom = atom(false);
export const transcriptResultAtom = atom(null);
```

Components access via `useAtom(atom)` or `useAtomValue(atom)` for read-only.

### Database (src/lib/db.js)

```javascript
// Pool auto-creates if POSTGRES_URL set, else disabled gracefully
const pool = getDbPool();

// Main function for storing transcripts
saveTranscriptResult({
  videoId,
  youtubeUrl,
  transcriptText,
  srt,
  durationSeconds,
});
// Returns { id, created_at, ... }

// Update transcript with LLM results (summary/qa/mindmap/quiz)
updateTranscriptFeatures(transcriptId, {
  summary,
  qa,
  mindmap,
  quiz,
});
```

JSONB columns store LLM outputs. Fallback to memory if DB unavailable.

### OpenAI LLM Integration (src/lib/openai.js)

```javascript
getOpenAIClient(); // Cached singleton
// Functions return stubs if OPENAI_API_KEY missing (dev mode)
generateSummaryFromTranscript(transcript, prompt, durationSeconds);
generateQaFromTranscript(transcript, prompt);
generateMindmapFromTranscript(transcript, prompt);
generateQuizFromTranscript(transcript, prompt, quizCount);
```

Quiz count auto-scales with video duration (10–30 questions).

### YouTube Integration (src/lib/youtube.js)

```javascript
extractVideoId(url); // Parse YouTube URL → video ID
fetchYoutubeTranscript(videoId); // Returns { text, srt, segments, lang }
```

Uses `youtube-transcript-api` wrapper; returns SRT format for subtitles.

### UI Components

**Step Navigation:** `StepLayout` wraps pages with 5-step navbar (transcribe → summary → QA → mindmap → quiz). Gradients hardcoded in Tailwind classes.

**Primitives:** `Button`, `Card` in `src/components/ui/` — use `cn()` (clsx wrapper) for class merging.

**Mermaid Viewer:** `MermaidCanvas` renders diagram JSON in browser; `/mermaid` page is sandbox.

## Cross-Component Communication

1. **Fetch → State → UI:** Frontend calls server action → Jotai atom updated → components re-render.
2. **Session Flow:** NextAuth stores JWT in cookie; `useSession()` retrieves session in client components; server actions auto-receive session via callback.
3. **Error Propagation:** Server action throws → caught by client via try-catch → error atom updated → UI shows message.

## Deployment

**Backend (VPS via IDcloudhost):**

```bash
bun install && bun run build
bun run start  # or pm2
```

Expose port 3000; set all `.env` vars including `POSTGRES_URL`, `NEXTAUTH_URL`.

**Frontend (Cloudflare Pages):**

- Build: `bun install && bun run build`
- Output: `.next` (Cloudflare handles)
- Set `NEXT_PUBLIC_APP_URL` to Pages domain; point `NEXTAUTH_URL` to VPS backend

## Key Files to Review

- `src/actions/transcription.js` — Main pipeline logic
- `src/lib/openai.js` — LLM prompt templates & response parsing
- `src/lib/db.js` — DB layer & memory fallback
- `src/state/transcribe-atoms.js` — Frontend state model
- `src/components/step-layout.jsx` — UI navigation pattern
- `next.config.mjs` — Minimal (no custom webpack)
- `tailwind.config.js` — Gradient colors, theme tokens
