# Paperwork

AI-assisted paperwork manager for students in Germany. Upload an official letter (PDF or photo), review the extracted data (sender, amount, deadline, required action) side by side with the original, and confirmed documents become tasks with reminders. Paperwork also tracks the 140 full / 280 half work-day limit for non-EU students from payslips.

**Core principle:** AI proposes → deterministic rules validate → user confirms → system acts. Nothing is created or sent without explicit confirmation.

> Status: auth, read-only pages with real data, upload and the processing pipeline (text recognition, classification, extraction, validation, summary). No review screen yet.

## Stack

- TypeScript (strict), Next.js App Router, React, pnpm
- Tailwind CSS v4 + shadcn/ui (Radix), Geist / Geist Mono
- next-themes (light / dark / system)
- next-intl (German and English, locale stored in a cookie)
- Postgres on Neon (EU) + Drizzle ORM
- Better Auth (email and password)
- Storage: local filesystem in development, Cloudflare R2 (EU jurisdiction) in production
- Inngest for the processing pipeline
- pdfjs-dist (PDF text layer) and tesseract.js (OCR, German + English)
- Vercel AI SDK with Zod structured output; Google Gemini Flash by default, Anthropic switchable
- Vitest, ESLint, Prettier, GitHub Actions

Planned: React Email + Postmark, Sentry, Playwright.

## Getting started

Requirements: Node.js 22+, pnpm, a Neon Postgres database, a Google AI Studio API key.

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_GENERATIVE_AI_API_KEY
pnpm db:migrate              # create the tables
```

Then run the app and the Inngest dev server side by side, in two terminals:

```bash
# Terminal 1: the app on http://localhost:3000
pnpm dev

# Terminal 2: the Inngest dev server (runs the pipeline; no account needed)
pnpm inngest:dev
```

Open http://localhost:3000, create an account and upload a letter in the Inbox. The Inngest dashboard at http://localhost:8288 shows every pipeline run with its steps, retries and errors.

`.env.local` needs `INNGEST_DEV=1` so the app sends events to the local dev server. If the app runs on another port, start the dev server with `pnpm exec inngest-cli dev -u http://localhost:<port>/api/inngest --no-discovery`. Uploads made while the dev server is not running show as failed in the Inbox; start it and press Retry.

### Processing pipeline

Each upload is stored unchanged (`users/{userId}/{documentId}/original.{ext}`) and processed in separate, individually retried steps:

1. **Text recognition**: words with positions from the PDF text layer, or OCR for images and scanned PDFs. OCR language data (~15 MB) is downloaded once into `.data/tesseract`.
2. **Classification** into one of the fixed document types.
3. **Extraction** of that type's fields (value, exact source text, confidence; missing stays empty), then each source text is located in the recognized words to get page and bounding box.
4. **Validation** with deterministic rules (dates, amounts, IBAN checksum, reference formats, deadlines after the letter date, required fields).
5. **Summary** in plain language, in the user's language.

The AI provider is set by `AI_PROVIDER` (`google` or `anthropic`) and optionally `AI_MODEL`; only `src/server/ai` knows about providers.

**Gemini free tier:** inputs may be used by Google to improve its models, so only upload fictional documents. Each document uses three requests, and the free tier has a small daily limit per model (20 requests per day for `gemini-flash-latest` at the time of writing). When the limit is reached, documents fail with "daily AI limit reached" and can be retried later, or set `AI_MODEL=gemini-flash-lite-latest` to use a separate, faster model.

### Sample letters

`fixtures/` contains two fictional letters for manual testing: an electricity invoice PDF with a text layer and an appointment letter as a PNG image (OCR). Regenerate them with `pnpm fixtures`.

### Demo data

```bash
pnpm db:seed --email you@example.com
```

Fills the account with fictional documents, tasks (one overdue), records and work days. Creates the user if it does not exist (pass `--password` or use the printed one). Running it again replaces that user's data.

## Scripts

| Script              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Start the dev server                        |
| `pnpm inngest:dev`  | Start the Inngest dev server for `pnpm dev` |
| `pnpm build`        | Production build                            |
| `pnpm start`        | Serve the production build                  |
| `pnpm lint`         | ESLint                                      |
| `pnpm typecheck`    | Generate route types and run tsc            |
| `pnpm test`         | Run unit tests (Vitest)                     |
| `pnpm format`       | Format with Prettier                        |
| `pnpm format:check` | Check formatting                            |
| `pnpm db:generate`  | Generate a migration from schema changes    |
| `pnpm db:migrate`   | Apply migrations                            |
| `pnpm db:studio`    | Open Drizzle Studio                         |
| `pnpm db:seed`      | Seed demo data for a user                   |
| `pnpm fixtures`     | Regenerate the sample letters in `fixtures` |

## Project structure

```
messages/              UI strings (de.json, en.json)
docs/design/           Design mockup
drizzle/               SQL migrations
fixtures/              Fictional sample letters
scripts/               Development scripts
src/app/(app)/         App routes inside the shell (require a session)
src/app/(auth)/        Sign in and sign up
src/app/api/           Auth, upload and Inngest endpoints
src/components/        Shared components (data/, shell/, upload/, ui/ from shadcn)
src/i18n/              Locale config and next-intl request config
src/lib/               Pure logic: dates, formatting, field schemas, validation rules, text matching
src/server/            Server-only code: db, auth, storage, ai, pipeline, inngest, queries, actions
src/proxy.ts           Redirects page requests without a session cookie to sign in
```

Design rules and project conventions are in [CLAUDE.md](CLAUDE.md).
