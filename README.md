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

Requirements: Node.js 22+, pnpm, a Neon Postgres database. A Google AI Studio API key is optional: without one, use `AI_PROVIDER=mock` (see below).

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, BETTER_AUTH_SECRET and the AI settings
pnpm db:migrate              # create the tables
pnpm dev:all                 # Next.js and the Inngest dev server together
```

`pnpm dev:all` starts the app on http://localhost:3000 and the Inngest dev server on http://localhost:8288 in one terminal (output prefixed with `[next]` and `[inngest]`). Inngest runs the processing pipeline locally; no account is needed. Its dashboard shows every pipeline run with its steps, retries and errors. If one of the two fails to start (for example because another `pnpm dev` or Inngest dev server already uses the port), both are stopped; close the other instance and run it again.

You can also run them separately with `pnpm dev` and `pnpm inngest:dev` in two terminals.

Open http://localhost:3000, create an account and upload a letter in the Inbox.

`.env.local` needs `INNGEST_DEV=1` so the app sends events to the local dev server. If the app runs on another port, start the dev server with `pnpm exec inngest-cli dev -u http://localhost:<port>/api/inngest --no-discovery`.

If the Inngest dev server is not running, uploads show "Processing service not running, start it with pnpm dev:all" in the Inbox, with the technical error underneath (e.g. `connect ECONNREFUSED 127.0.0.1:8288`). Start it and press Retry.

### Processing pipeline

Each upload is stored unchanged (`users/{userId}/{documentId}/original.{ext}`) and processed in separate, individually retried steps:

1. **Text recognition**: words with positions from the PDF text layer, or OCR for images and scanned PDFs. OCR language data (~15 MB) is downloaded once into `.data/tesseract`.
2. **Classification** into one of the fixed document types.
3. **Extraction** of that type's fields (value, exact source text, confidence; missing stays empty), then each source text is located in the recognized words to get page and bounding box.
4. **Validation** with deterministic rules (dates, amounts, IBAN checksum, reference formats, deadlines after the letter date, required fields).
5. **Summary** in plain language, in the user's language.

The AI provider is set by `AI_PROVIDER` and optionally `AI_MODEL`; only `src/server/ai` knows about providers:

| `AI_PROVIDER`      | Needs                          | Notes                                                                                                                                                            |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `google` (default) | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini Flash (`gemini-flash-latest`)                                                                                                                             |
| `anthropic`        | `ANTHROPIC_API_KEY`            | Claude (`claude-opus-5-5`)                                                                                                                                       |
| `mock`             | nothing                        | Fixed results for the letters in `fixtures/letters`; other documents become "other" with no fields. Used by the tests and CI, and handy for offline development. |

**Gemini free tier:** inputs may be used by Google to improve its models, so only upload fictional documents. Each document uses three requests, and the free tier has a small daily limit per model (20 requests per day for `gemini-flash-latest` at the time of writing). When the limit is reached, documents fail with "daily AI limit reached" and can be retried later, or set `AI_MODEL=gemini-flash-lite-latest` to use a separate, faster model.

### Sample letters

`fixtures/letters/` contains seven fictional letters (invoices, an appointment photo, a payslip, an invalid IBAN, an information letter and a blurry photo). `fixtures/letters/EXPECTED_RESULTS.md` lists what each one should produce. With `AI_PROVIDER=mock` they are processed without an API key, and `pnpm test` runs all of them through text recognition, extraction, source location and validation.

### Demo data

```bash
pnpm db:seed --email you@example.com
```

Fills the account with fictional documents, tasks (one overdue), records and work days. Creates the user if it does not exist (pass `--password` or use the printed one). Running it again replaces that user's data.

## Scripts

| Script              | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev:all`      | Start Next.js and the Inngest dev server    |
| `pnpm dev`          | Start the dev server                        |
| `pnpm inngest:dev`  | Start the Inngest dev server for `pnpm dev` |
| `pnpm build`        | Production build                            |
| `pnpm start`        | Serve the production build                  |
| `pnpm lint`         | ESLint                                      |
| `pnpm typecheck`    | Generate route types and run tsc            |
| `pnpm test`         | Run tests (Vitest, uses `AI_PROVIDER=mock`) |
| `pnpm format`       | Format with Prettier                        |
| `pnpm format:check` | Check formatting                            |
| `pnpm db:generate`  | Generate a migration from schema changes    |
| `pnpm db:migrate`   | Apply migrations                            |
| `pnpm db:studio`    | Open Drizzle Studio                         |
| `pnpm db:seed`      | Seed demo data for a user                   |

## Project structure

```
messages/              UI strings (de.json, en.json)
docs/design/           Design mockup
drizzle/               SQL migrations
fixtures/              Fictional sample letters
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
