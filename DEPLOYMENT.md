# Deployment

Production setup: **Vercel** (app), **Neon** (Postgres, EU), **Cloudflare R2** (original files, EU jurisdiction) and **Inngest Cloud** (processing pipeline and daily jobs). Follow the steps in order; each service gives you values that a later step needs.

> Read [Known limits on Vercel](#known-limits-on-vercel) before going live: uploads above 4.5 MB do not reach the app on Vercel without a change.

## 1. Neon (database)

1. Create a project at https://console.neon.tech. Region: **AWS Europe Central 1 (Frankfurt)**, or another EU region. Postgres version: the default.
2. In the project's **Connection details**, copy the connection string of the `main` branch. It looks like `postgresql://USER:PASSWORD@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`. This is `DATABASE_URL`.
3. Create the tables from your machine, pointing at the production database:

   ```bash
   DATABASE_URL="postgresql://…" pnpm db:migrate
   ```

   (On Windows PowerShell: `$env:DATABASE_URL="postgresql://…"; pnpm db:migrate`.) Run this again after every release that adds a file to `drizzle/`.

4. Optional: in **Settings → Compute**, allow scale-to-zero for a small instance; the app uses Neon's HTTP driver, so cold starts only add latency.

## 2. Cloudflare R2 (original files)

1. In the Cloudflare dashboard, open **R2 Object Storage** and enable R2 for the account if needed.
2. **Create bucket**: name e.g. `paperwork-originals`, **Location: Specify jurisdiction → European Union (EU)**. The jurisdiction cannot be changed later. The app uses the EU endpoint `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`, so the bucket must be in the EU jurisdiction.
3. Keep the bucket **private**: no public access, no custom domain. Originals are only served through the app after an ownership check.
4. **Manage R2 API tokens → Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: only `paperwork-originals`
   - Create, then copy the **Access Key ID** and **Secret Access Key** (shown once).
5. Copy the **Account ID** from the R2 overview page.

Values: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `STORAGE_DRIVER=r2`.

## 3. AI provider

- **Google (default):** create a key at https://aistudio.google.com/apikey → `GOOGLE_GENERATIVE_AI_API_KEY`. For real documents use a **paid** Gemini API tier: on the free tier Google may use inputs to improve its products, and the daily request limit is very small. Optional `AI_MODEL` (default `gemini-flash-latest`; `gemini-flash-lite-latest` is faster).
- **Anthropic:** `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` from https://console.anthropic.com. Default model `claude-opus-5-5`, override with `AI_MODEL`.
- Never use `AI_PROVIDER=mock` in production; it only knows the sample letters.

## 4. Vercel (app)

1. **Add New → Project**, import the GitHub repository.
2. Build settings (Vercel detects most of them):
   - Framework preset: **Next.js**
   - Install command: `pnpm install --frozen-lockfile` (pnpm is picked from `packageManager` in `package.json`)
   - Build command: `pnpm build`
   - Node.js version (Settings → General): **22.x**
3. **Settings → Functions → Function Region**: choose **Frankfurt, Germany (fra1)** so functions run next to Neon and R2.
4. Add the environment variables from the table below for **Production** (and Preview if you use preview deployments, ideally with a separate Neon branch and R2 bucket). Leave the Inngest keys for step 5.
5. Deploy. Note the production URL, e.g. `https://paperwork.example.com`, and set `BETTER_AUTH_URL` to exactly that URL (scheme, no trailing slash). Redeploy after changing it.
6. Optional: add a custom domain under **Settings → Domains**, then update `BETTER_AUTH_URL` and redeploy.

## 5. Inngest Cloud (pipeline and daily jobs)

1. Create an account at https://app.inngest.com and use the **Production** environment.
2. Recommended: install the **Inngest integration for Vercel** (Inngest dashboard → Integrations → Vercel, or the Vercel Marketplace) and connect the project. It sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` on Vercel and syncs the app on every deployment.
3. Without the integration:
   - In Inngest, **Manage → Event Keys → Create Event Key** → `INNGEST_EVENT_KEY`.
   - **Manage → Signing Key** → `INNGEST_SIGNING_KEY`.
   - Add both to Vercel (Production), redeploy, then in Inngest **Apps → Sync new app** with the URL `https://<your-domain>/api/inngest`.
4. Check in **Apps** that the app `paperwork` lists two functions: **process-document** (event `document/uploaded`) and **purge-history** (cron `TZ=Europe/Berlin 0 3 * * *`).
5. **Do not set `INNGEST_DEV` in production.** With it, the app sends events to a local dev server instead of Inngest Cloud.
6. If the Vercel project uses Deployment Protection, allow Inngest to reach `/api/inngest` (the integration configures a bypass; otherwise add a Protection Bypass for Automation secret in Vercel and enter it in Inngest's app settings).

## 6. Smoke test after deploying

1. Open the production URL, create an account, upload a small fictional PDF (under 4.5 MB), e.g. `fixtures/letters/01_krankenkasse_beitragsrechnung.pdf`.
2. The Inbox should move through Text recognition → Classification → Extraction → Validation → Writing summary to "Ready to confirm". In Inngest → Runs you see the run with five steps.
3. Upload a photo (`fixtures/letters/03_auslaenderbehoerde_terminbestaetigung.jpg`) to check OCR on Vercel.
4. Open Review, confirm, and check that the task appears under Tasks.
5. In R2, the bucket contains `users/<userId>/<documentId>/original.pdf`.
6. Delete the test account under Settings → Delete account.

## Environment variables

| Variable                       | Required       | Production value            | Notes                                                                                                             |
| ------------------------------ | -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | yes            | Neon connection string (EU) | From step 1.                                                                                                      |
| `BETTER_AUTH_SECRET`           | yes            | 32+ random characters       | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Changing it signs everyone out. |
| `BETTER_AUTH_URL`              | yes            | `https://<your-domain>`     | Exact public URL, no trailing slash.                                                                              |
| `BETTER_AUTH_TRUSTED_ORIGINS`  | no             | empty                       | Extra origins allowed to call the auth API, comma-separated (only for additional domains).                        |
| `STORAGE_DRIVER`               | yes            | `r2`                        | `local` writes to disk and does not work on Vercel.                                                               |
| `R2_ACCOUNT_ID`                | with r2        | Cloudflare account ID       | From step 2.                                                                                                      |
| `R2_ACCESS_KEY_ID`             | with r2        | R2 token access key         | From step 2.                                                                                                      |
| `R2_SECRET_ACCESS_KEY`         | with r2        | R2 token secret             | From step 2.                                                                                                      |
| `R2_BUCKET`                    | with r2        | e.g. `paperwork-originals`  | Bucket in the EU jurisdiction.                                                                                    |
| `LOCAL_STORAGE_DIR`            | no             | not set                     | Only for `STORAGE_DRIVER=local` (default `.data/uploads`).                                                        |
| `AI_PROVIDER`                  | no             | `google` or `anthropic`     | Default `google`.                                                                                                 |
| `AI_MODEL`                     | no             | e.g. `gemini-flash-latest`  | Overrides the provider's default model.                                                                           |
| `GOOGLE_GENERATIVE_AI_API_KEY` | with google    | Gemini API key              | Use a paid tier for real documents.                                                                               |
| `ANTHROPIC_API_KEY`            | with anthropic | Anthropic API key           |                                                                                                                   |
| `TESSERACT_CACHE_DIR`          | yes on Vercel  | `/tmp/tesseract`            | OCR language data (~15 MB) is downloaded here; on Vercel only `/tmp` is writable.                                 |
| `INNGEST_EVENT_KEY`            | yes            | from Inngest                | Set by the Vercel integration, or step 5.                                                                         |
| `INNGEST_SIGNING_KEY`          | yes            | from Inngest                | Set by the Vercel integration, or step 5.                                                                         |
| `INNGEST_DEV`                  | no             | **not set**                 | Only `1` for local development.                                                                                   |

## Known limits on Vercel

- **Upload size:** Vercel Functions accept request bodies up to **4.5 MB**, but the app allows uploads up to 20 MB through `/api/documents` and `/api/documents/[id]/replace`. Larger files are rejected by Vercel before they reach the app. Before going live, either lower `MAX_UPLOAD_BYTES` in `src/lib/files.ts` to 4 MB (and the "up to 20 MB" texts in `messages/*.json`), or change uploads to go directly from the browser to R2 with presigned URLs. The latter is not implemented yet.
- **Function duration:** `/api/inngest` sets `maxDuration = 300` seconds. Each Inngest step is a separate request, so a step only needs to finish within the plan's limit; OCR of a photo takes a few seconds, AI steps 5 to 45 seconds. If your plan allows less than 300 seconds, lower `maxDuration` in `src/app/api/inngest/route.ts` to the plan's maximum.
- **OCR language data:** tesseract.js downloads the German and English language data from a CDN into `TESSERACT_CACHE_DIR` on the first OCR of each cold function instance, which adds a few seconds to that step.
- **Native packages:** `@napi-rs/canvas`, `pdfjs-dist` and `tesseract.js` are loaded from `node_modules` at runtime (`serverExternalPackages` in `next.config.ts`); Vercel's Linux build installs the matching prebuilt binaries.

## Releasing an update

1. Push to `main`; CI runs lint, format, typecheck, tests and build.
2. If the release adds migrations in `drizzle/`, run `pnpm db:migrate` against production **before** the new deployment goes live (migrations so far only add tables and columns).
3. Vercel deploys `main` automatically; the Inngest integration re-syncs the app. Without it, press **Resync** on the app in Inngest.
