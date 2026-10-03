# Paperwork

AI-assisted paperwork manager for students in Germany. Upload an official letter (PDF or photo), review the extracted data (sender, amount, deadline, required action) side by side with the original, and confirmed documents become tasks with reminders. Paperwork also tracks the 140 full / 280 half work-day limit for non-EU students from payslips.

**Core principle:** AI proposes → deterministic rules validate → user confirms → system acts. Nothing is created or sent without explicit confirmation.

> Status: database, email/password auth and read-only pages (Overview, Inbox, Tasks, Records) with real data. No upload or AI pipeline yet.

## Stack

- TypeScript (strict), Next.js App Router, React, pnpm
- Tailwind CSS v4 + shadcn/ui (Radix), Geist / Geist Mono
- next-themes (light / dark / system)
- next-intl (German and English, locale stored in a cookie)
- Postgres on Neon (EU) + Drizzle ORM
- Better Auth (email and password)
- Vitest, ESLint, Prettier, GitHub Actions

Planned: Cloudflare R2, Vercel AI SDK + Zod, Inngest, React Email + Postmark, Sentry, Playwright.

## Getting started

Requirements: Node.js 22+, pnpm, a Neon Postgres database.

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:migrate              # create the tables
pnpm dev
```

Open http://localhost:3000 and create an account.

### Demo data

```bash
pnpm db:seed --email you@example.com
```

Fills the account with fictional documents, tasks (one overdue), records and work days. Creates the user if it does not exist (pass `--password` or use the printed one). Running it again replaces that user's data.

## Scripts

| Script              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Start the dev server                     |
| `pnpm build`        | Production build                         |
| `pnpm start`        | Serve the production build               |
| `pnpm lint`         | ESLint                                   |
| `pnpm typecheck`    | Generate route types and run tsc         |
| `pnpm test`         | Run unit tests (Vitest)                  |
| `pnpm format`       | Format with Prettier                     |
| `pnpm format:check` | Check formatting                         |
| `pnpm db:generate`  | Generate a migration from schema changes |
| `pnpm db:migrate`   | Apply migrations                         |
| `pnpm db:studio`    | Open Drizzle Studio                      |
| `pnpm db:seed`      | Seed demo data for a user                |

## Project structure

```
messages/              UI strings (de.json, en.json)
docs/design/           Design mockup
drizzle/               SQL migrations
src/app/(app)/         App routes inside the shell (require a session)
src/app/(auth)/        Sign in and sign up
src/components/        Shared components (data/, shell/, ui/ from shadcn)
src/i18n/              Locale config and next-intl request config
src/lib/               Pure utilities (dates, formatting, summary) and shared schemas
src/server/            Server-only code: db, auth, queries, actions
src/proxy.ts           Redirects requests without a session cookie to sign in
```

Design rules and project conventions are in [CLAUDE.md](CLAUDE.md).
