# Paperwork

AI-assisted paperwork manager for students in Germany. Users upload official letters (PDF/photo); the system extracts key data (sender, amount, deadline, required action), the user reviews it side by side with the original, and confirmed documents become tasks with reminders. Also tracks the 140 full / 280 half work-day limit for non-EU students from payslips.

## Core principle
AI proposes → deterministic rules validate → user confirms → system acts.
- Nothing is created or sent without explicit user confirmation.
- Every extracted value stores its source (page + text + position) so it can be highlighted in the original.
- Original files are immutable. Every change is written to an audit log (actor: system | ai | user).

## Document lifecycle
received → processing → needs_review → confirmed → (tasks created) → completed → archived
Side paths: rejected/reprocess, information_only.

## Document types (fixed)
invoice, appointment, decision_letter, contract, payslip, information_only, other. Each type has its own Zod field schema.

## Pages
Overview, Inbox, Review (opened from Inbox, not in sidebar), Tasks, Records, Work days, Settings (reminders, delete documents, delete account, history log).

## Stack
- TypeScript (strict), Next.js App Router, React, pnpm
- Tailwind CSS + shadcn/ui, Geist font
- next-themes (light / dark / system), next-intl (de, en; German date/number formats)
- Later steps: Postgres (Neon, EU) + Drizzle ORM, Better Auth, Cloudflare R2, Vercel AI SDK + Zod structured outputs, Inngest (pipeline + reminders), React Email + Postmark, Sentry, Vitest + Playwright, GitHub Actions

## Design rules
Follow docs/design/mockup.html. Minimalist: white/neutral surfaces, thin borders, no shadows or gradients, no emojis, no "AI sparkle" icons. Color only carries meaning: red = overdue/missing, amber = check, green = valid, one dark teal accent. Sentence-case headings. Status = small colored dot + text.

## Conventions
- All user-facing strings go through next-intl (messages/de.json, messages/en.json). No hardcoded UI text.
- Validation rules are pure functions with unit tests.
- Server code in src/server, shared schemas in src/lib/schemas.
- Small commits with clear messages. Run lint, typecheck and tests before finishing a task.
