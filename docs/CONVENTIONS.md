# Project conventions

How Paperwork is built and the rules every change follows. For setup and deployment see the [README](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md).

## Product

Paperwork is a paperwork manager for students in Germany. Users upload official letters (PDF or photo); the system extracts the key data (sender, amount, deadline, required action), the user reviews it side by side with the original, and confirmed documents become tasks with reminders. It also tracks the yearly work-day limit for non-EU students (140 full or 280 half days) from payslips.

### Core principle

**AI proposes → deterministic rules validate → user confirms → system acts.**

- Nothing is created or sent without explicit user confirmation. Every server action re-checks the rules; the browser's checks are a convenience, not a gate.
- The model only proposes values. Validation, task creation and work-day counting are deterministic code, never model output.
- Every extracted value keeps its source (page, source text, bounding box) so it can be highlighted in the original.
- Original files are immutable: a replacement file gets a new storage key, the old one is deleted.
- Every change is written to the audit log with an actor (`system`, `ai` or `user`) and, where meaningful, before and after values. Single audit entries are never deleted by users; deleting a document removes the content of its entries, and retention removes old entries.

## Domain

### Document types (fixed)

`invoice`, `appointment`, `decision_letter`, `contract`, `payslip`, `information_only`, `other`. Each type has its own field definitions in `src/lib/schemas/document-fields.ts`; the AI extraction schema (Zod) and the validation rules are both derived from them. Adding a field means adding it there, plus its labels in `messages/*.json`.

### Document lifecycle

```
received → processing → needs_review → confirmed
                                     ↘ information_only
failed   (any processing step; Retry starts again)
```

- `received`: stored, waiting for the pipeline. A document that does not start within a minute offers Retry.
- `processing`: the Inngest pipeline runs; `processing_stage` says which step (text recognition, classification, extraction, validation, summary).
- `needs_review`: waiting for the user in the Review screen.
- `confirmed`: values confirmed; tasks, reminders and work-day entries were created by the task rules.
- `information_only`: filed without tasks.
- `failed`: a step failed; `error_message` holds a translatable code, `error_detail` the technical cause.
- `rejected` exists in the enum but is not used yet.

Unconfirmed documents (`received`, `processing`, `needs_review`, `failed`) can be discarded; a replacement file is allowed except while processing. Confirmed and information-only documents can be deleted from Records with everything created from them.

Tasks are `open` or `done` (with an optional completion note). Archiving is planned.

### Task rules

Defined once in `src/lib/task-rules.ts` and used both for the Review preview ("On confirmation this creates") and for confirming:

- invoice → pay task (amount, due date) with reminders, unless paid by direct debit
- appointment → attend task on the date and prepare task the day before
- decision_letter → respond task if a response deadline exists; other → task if a deadline exists
- payslip → work-day entry, no task; none if the day counts are marked "not stated"
- contract, information_only → nothing

Reminders follow the user's offsets (default 7, 3 and 1 days before), at 08:00 German time, never in the past.

## Pages

Overview, Inbox, Review (`/inbox/[id]`, opened from the Inbox, not in the sidebar), Tasks, Records (with a read-only document page at `/records/[id]`), Work days, Settings (reminders, history retention, delete all documents, delete account, history log), Help.

## Architecture

| Layer          | Where                                            | Notes                                                                                                                                                                                        |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes         | `src/app/(app)`, `src/app/(auth)`, `src/app/api` | Server components by default; `src/proxy.ts` redirects page requests without a session cookie, and every page, action and API route checks the session itself.                               |
| UI components  | `src/components`                                 | `ui/` is shadcn/ui (owned code), the rest is app components.                                                                                                                                 |
| Pure logic     | `src/lib`                                        | Validation, source-text matching, task rules, work days, review logic, deletion plans, formatting. No database or network access; unit-tested.                                               |
| Shared schemas | `src/lib/schemas`                                | Field definitions per document type.                                                                                                                                                         |
| Server code    | `src/server`                                     | `db` (Drizzle schema), `auth`, `storage` (local / R2), `ai` (provider isolation), `pipeline` (stages), `inngest` (functions), `queries`, `actions` (server actions), `documents` (deletion). |
| Migrations     | `drizzle/`                                       | Generated with `pnpm db:generate`, applied with `pnpm db:migrate`, committed.                                                                                                                |
| Messages       | `messages/de.json`, `messages/en.json`           | All user-facing text.                                                                                                                                                                        |

- **AI providers** are only known to `src/server/ai`. Switch with `AI_PROVIDER=google|anthropic|mock` and `AI_MODEL`; the pipeline calls `classifyDocument`, `extractFields` and `summarizeDocument` only.
- **Background work** runs in Inngest: `process-document` (one step per stage, retried, rate limits respected) and `purge-history` (daily retention).
- **Data ownership:** every table has a `user_id`, and every query filters by the session's user.
- **Writes that belong together** (a change and its audit entry) go into one `db.batch([...])`; the Neon HTTP driver has no interactive transactions.

## Stack

TypeScript (strict), Next.js App Router, React, pnpm · Tailwind CSS, shadcn/ui, Geist · next-themes (light / dark / system) · next-intl (de, en; German date and number formats) · Postgres on Neon (EU) with Drizzle ORM · Better Auth · Cloudflare R2 (EU jurisdiction) · Vercel AI SDK with Zod structured output · Inngest · pdf.js, tesseract.js · Vitest · GitHub Actions.

Planned: React Email + Postmark for reminder emails, Sentry, Playwright.

## Design rules

Follow [docs/design/mockup.html](design/mockup.html).

- Minimalist: white and neutral surfaces, thin borders, no shadows or gradients, no emojis, no "AI sparkle" icons.
- Color only carries meaning: red = overdue or missing, amber = check, green = valid, one dark teal accent (`brand`). Colors come from the tokens in `src/app/globals.css`, never hard-coded, and work in light and dark mode.
- Sentence-case headings.
- Status = small colored dot + text (`StatusDot`), never color alone.
- Destructive actions use a dialog with a danger button; the most destructive ones (delete all documents, delete account) require typing a confirmation.

## Code conventions

- All user-facing strings go through next-intl (`messages/de.json`, `messages/en.json`), in both languages. No hard-coded UI text, including accessible labels.
- Validation rules and other business rules are pure functions in `src/lib` with unit tests.
- Server code lives in `src/server`; shared schemas in `src/lib/schemas`.
- Server actions validate their input with Zod, check the session and ownership, and return typed results instead of throwing for expected errors.
- Secrets stay in `.env.local` (development) or the hosting provider's settings; `.env.example` lists every variable without values.
- Small commits with clear messages. Before finishing a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.
