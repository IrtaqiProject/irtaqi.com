# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router routes, layouts, and API route handlers (e.g., `src/app/api/transcripts/route.js`).
- `src/actions/`: Server actions (`"use server"`) for auth, YouTube, transcription, and health.
- `src/components/`: UI and feature components; shared primitives live in `src/components/ui/`.
- `src/lib/`: Core helpers (DB, auth, OpenAI, YouTube, formatting, etc.).
- `src/state/`: Jotai atoms for UI and feature state.
- `public/`: Static assets.
- `migrations/` and `scripts/migrate.js`: Postgres schema migrations.

## Build, Test, and Development Commands
- `bun install`: Install dependencies (Bun is the primary package manager).
- `bun dev`: Run the Next.js dev server at http://localhost:3000.
- `bun run build`: Production build.
- `bun run start`: Run the production server.
- `bun run lint`: ESLint (Next.js core-web-vitals rules).
- `bun run migrate`: Apply database migrations.

## Coding Style & Naming Conventions
- JavaScript/JSX only (no TypeScript). Use 2-space indentation, double quotes, and semicolons (match existing files).
- File names are lowercase with dashes (e.g., `user-badge.jsx`); React components use PascalCase.
- Prefer `@/` imports for `src/` (see `jsconfig.json`).

## Testing Guidelines
- No dedicated test framework is configured yet; `bun run lint` is the current automated check.
- If you add tests, include a runnable script in `package.json` and document the runner in this file.

## Commit & Pull Request Guidelines
- Commit messages are short and imperative (e.g., `fix bug`, `repair download format`, `chore: update bun.lock`).
- Keep commits focused; avoid mixing refactors with behavior changes when possible.
- PRs should include: a clear description of changes, the test/lint command run (or “not run”), and screenshots for UI changes.

## Configuration Notes
- Store secrets in `.env.local` (see `README.md` for required keys like `NEXTAUTH_*`, `OPENAI_API_KEY`, and `POSTGRES_URL`).
- Never commit real credentials or production URLs.
