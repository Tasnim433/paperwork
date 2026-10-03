# Paperwork

AI-assisted paperwork manager for students in Germany. Upload an official letter (PDF or photo), review the extracted data (sender, amount, deadline, required action) side by side with the original, and confirmed documents become tasks with reminders. Paperwork also tracks the 140 full / 280 half work-day limit for non-EU students from payslips.

**Core principle:** AI proposes → deterministic rules validate → user confirms → system acts. Nothing is created or sent without explicit confirmation.

> Status: project skeleton (app shell, theming, i18n, tooling). No database, auth or AI pipeline yet.

## Stack

- TypeScript (strict), Next.js App Router, React, pnpm
- Tailwind CSS v4 + shadcn/ui (Radix), Geist / Geist Mono
- next-themes (light / dark / system)
- next-intl (German and English, locale stored in a cookie)
- Vitest, ESLint, Prettier, GitHub Actions

Planned: Postgres (Neon, EU) + Drizzle, Better Auth, Cloudflare R2, Vercel AI SDK + Zod, Inngest, React Email + Postmark, Sentry, Playwright.

## Getting started

Requirements: Node.js 22+, pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start the dev server             |
| `pnpm build`        | Production build                 |
| `pnpm start`        | Serve the production build       |
| `pnpm lint`         | ESLint                           |
| `pnpm typecheck`    | Generate route types and run tsc |
| `pnpm test`         | Run unit tests (Vitest)          |
| `pnpm format`       | Format with Prettier             |
| `pnpm format:check` | Check formatting                 |

## Project structure

```
messages/            UI strings (de.json, en.json)
docs/design/         Design mockup
src/app/(app)/       App routes rendered inside the shell
src/components/      Shared components (shell/, ui/ from shadcn)
src/i18n/            Locale config and next-intl request config
src/lib/             Shared utilities and schemas
src/server/          Server-only code and server actions
```

Design rules and project conventions are in [CLAUDE.md](CLAUDE.md).
