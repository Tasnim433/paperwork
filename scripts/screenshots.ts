/**
 * Takes the README screenshots with Playwright.
 *
 *   pnpm screenshots              build, then capture
 *   pnpm screenshots --skip-build reuse the existing production build
 *
 * Runs its own production server (no dev indicator) and Inngest dev server on
 * separate ports, with AI_PROVIDER=mock and a fixed date. Creates a dedicated
 * demo user with fictional data only (the letters in fixtures/letters plus a few
 * generated rows), captures the pages, checks that no email address, secret or
 * local path is visible, writes optimized PNGs to docs/screenshots and deletes
 * the demo user again. Real accounts are never touched.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing (.env.local)");

/** 09:30 in Germany on a Sunday in October 2026. */
const FIXED_NOW = "2026-10-04T07:30:00.000Z";
const APP_PORT = 3300;
const INNGEST_PORT = 8688;
const BASE = `http://localhost:${APP_PORT}`;
const OUT_DIR = path.join("docs", "screenshots");
const LETTERS = path.join("fixtures", "letters");
const DEMO = {
  email: "demo@paperwork.local",
  name: "Lena Beispiel",
  password: randomBytes(18).toString("base64url"),
};

const sql = neon(process.env.DATABASE_URL);
const children: ChildProcess[] = [];
const isWindows = process.platform === "win32";

function log(message: string) {
  console.log(`[screenshots] ${message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(label: string, check: () => Promise<boolean>, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check().catch(() => false)) return;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function start(command: string, args: string[], env: Record<string, string> = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => (output = (output + chunk).slice(-4000)));
  child.stderr?.on("data", (chunk) => (output = (output + chunk).slice(-4000)));
  child.on("exit", (code) => {
    if (code && code !== 0 && !stopping)
      console.error(`[screenshots] ${command} exited with ${code}\n${output}`);
  });
  children.push(child);
  return child;
}

let stopping = false;
function stopAll() {
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      if (isWindows)
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function removeDemoUser() {
  const rows = await sql`delete from users where email = ${DEMO.email} returning id`;
  for (const row of rows) {
    rmSync(path.join(".data", "uploads", "users", String(row.id)), {
      recursive: true,
      force: true,
    });
  }
}

/** Signs up the demo user through the app and returns its session cookies. */
async function createDemoUser(): Promise<{
  id: string;
  cookies: { name: string; value: string }[];
}> {
  const request = (route: string, body: object) =>
    fetch(`${BASE}/api/auth/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify(body),
    });
  const signUp = await request("sign-up/email", DEMO);
  if (!signUp.ok) throw new Error(`Sign-up failed: ${signUp.status}`);
  const signIn = await request("sign-in/email", { email: DEMO.email, password: DEMO.password });
  const cookies = signIn.headers.getSetCookie().map((cookie) => {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    return { name: pair.slice(0, index), value: pair.slice(index + 1) };
  });
  const [user] = await sql`select id from users where email = ${DEMO.email}`;
  return { id: String(user.id), cookies };
}

async function upload(cookieHeader: string, file: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(path.join(LETTERS, file))]), file);
  const response = await fetch(`${BASE}/api/documents`, {
    method: "POST",
    body: form,
    headers: { cookie: cookieHeader },
  });
  const body = (await response.json()) as { ok: boolean; documentId?: string; error?: string };
  if (!body.ok || !body.documentId) throw new Error(`Upload of ${file} failed: ${body.error}`);
  return body.documentId;
}

/** Fictional extra rows: an overdue and a completed task, earlier work days, one document mid-processing. */
async function addFictionalRows(userId: string) {
  await sql`insert into tasks (user_id, kind, title, due_date, status) values
    (${userId}, 'submit', 'Submit enrolment certificate to Musterkasse', '2026-10-01', 'open')`;
  await sql`insert into tasks (user_id, kind, title, due_date, amount_cents, status, completed_at, completion_note) values
    (${userId}, 'pay', 'Pay semester fee to Universität Musterstadt', '2026-09-15', 8800, 'done', '2026-09-12T09:00:00Z', 'Paid by bank transfer')`;
  const months: [string, number, number][] = [
    ["2026-01-01", 2, 1],
    ["2026-02-01", 1, 1],
    ["2026-03-01", 0, 2],
    ["2026-04-01", 2, 3],
    ["2026-05-01", 2, 3],
    ["2026-06-01", 1, 3],
    ["2026-07-01", 2, 2],
    ["2026-08-01", 9, 6],
  ];
  for (const [month, full, half] of months) {
    await sql`insert into work_entries (user_id, month, full_days, half_days, source) values (${userId}, ${month}, ${full}, ${half}, 'payslip')`;
  }
  // Shown as "Extraction" in the Inbox; no file and no pipeline run behind it.
  await sql`insert into documents (id, user_id, status, processing_stage, original_file_name, mime_type, storage_key, sha256, received_date)
    values (${randomUUID()}, ${userId}, 'processing', 'extraction', 'lohnabrechnung_oktober.pdf', 'application/pdf',
      ${`demo/${randomUUID()}`}, ${randomBytes(32).toString("hex")}, '2026-10-04')`;
}

type Shot = {
  file: string;
  path: string;
  locale: "en" | "de";
  dark?: boolean;
  prepare?: (page: Page) => Promise<void>;
};

/** Values that must never appear on a screenshot. */
function forbiddenStrings(): string[] {
  const values = [DEMO.email, DEMO.password, homedir(), process.cwd()];
  try {
    values.push(execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim());
  } catch {
    // no git identity configured
  }
  for (const key of [
    "BETTER_AUTH_SECRET",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "ANTHROPIC_API_KEY",
    "R2_SECRET_ACCESS_KEY",
  ]) {
    if (process.env[key]) values.push(process.env[key]!);
  }
  if (process.env.DATABASE_URL) values.push(new URL(process.env.DATABASE_URL).hostname);
  return values.filter((value) => value && value.length >= 6);
}

async function capture(browser: Browser, session: { name: string; value: string }[], shot: Shot) {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: shot.dark ? "dark" : "light",
    locale: shot.locale === "de" ? "de-DE" : "en-GB",
    timezoneId: "Europe/Berlin",
  });
  await context.addCookies(
    [...session, { name: "NEXT_LOCALE", value: shot.locale }].map((cookie) => ({
      ...cookie,
      url: BASE,
    })),
  );
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "load" });
  // Belt and braces: the production server has no dev indicator.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await shot.prepare?.(page);
  await sleep(600);

  const visible = await page.evaluate(() => document.body.innerText);
  const leaked = forbiddenStrings().filter((value) => visible.includes(value));
  if (leaked.length > 0) throw new Error(`${shot.file}: private value visible on the page`);

  const raw = await page.screenshot({ type: "png" });
  const optimized = await sharp(raw)
    .png({ palette: true, quality: 92, compressionLevel: 9, effort: 10 })
    .toBuffer();
  writeFileSync(path.join(OUT_DIR, shot.file), optimized);
  log(
    `${shot.file}: ${Math.round(raw.length / 1024)} KB -> ${Math.round(optimized.length / 1024)} KB`,
  );
  await context.close();
}

/** Review screen of letter 05 with the IBAN field focused, so its source is highlighted. */
async function focusIban(page: Page) {
  await page
    .locator('section[aria-label="Original document"] img')
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#field-iban").focus();
}

async function confirmInReview(
  browser: Browser,
  session: { name: string; value: string }[],
  documentId: string,
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(
    [...session, { name: "NEXT_LOCALE", value: "en" }].map((c) => ({ ...c, url: BASE })),
  );
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.goto(`${BASE}/inbox/${documentId}`);
  const button = page.getByRole("button", { name: "Confirm document" });
  await button.waitFor();
  // click() waits until the button is enabled (all fields valid).
  await button.click({ timeout: 30_000 });
  await waitFor(`confirmation of ${documentId}`, async () => {
    const [row] = await sql`select status from documents where id = ${documentId}`;
    return row?.status === "confirmed";
  });
  await context.close();
}

async function main() {
  if (!process.argv.includes("--skip-build")) {
    log("building the app");
    execFileSync("pnpm", ["build"], { stdio: "inherit", shell: isWindows });
  }

  await removeDemoUser();
  mkdirSync(OUT_DIR, { recursive: true });

  log("starting Inngest dev server and app");
  start("pnpm", [
    "exec",
    "inngest-cli",
    "dev",
    "-p",
    String(INNGEST_PORT),
    "--connect-gateway-port",
    String(INNGEST_PORT + 1),
    "--connect-gateway-grpc-port",
    "50082",
    "--connect-executor-grpc-port",
    "50083",
    "-u",
    `${BASE}/api/inngest`,
    "--no-discovery",
  ]);
  start("pnpm", ["exec", "next", "start", "-p", String(APP_PORT)], {
    AI_PROVIDER: "mock",
    FIXED_NOW,
    INNGEST_DEV: "1",
    INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}`,
    BETTER_AUTH_URL: BASE,
    BETTER_AUTH_TRUSTED_ORIGINS: "",
    STORAGE_DRIVER: "local",
  });
  await waitFor("app", async () => (await fetch(`${BASE}/sign-in`)).ok);
  await waitFor("Inngest", async () => (await fetch(`http://localhost:${INNGEST_PORT}`)).ok);
  await fetch(`${BASE}/api/inngest`, { method: "PUT" });

  log(`creating demo user ${DEMO.email}`);
  const demo = await createDemoUser();
  const cookieHeader = demo.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  log("uploading the fixture letters");
  const files = [
    "01_krankenkasse_beitragsrechnung.pdf",
    "02_beitragsstelle_zahlungsaufforderung.pdf",
    "03_auslaenderbehoerde_terminbestaetigung.jpg",
    "04_lohnabrechnung_september_2026.pdf",
    "05_nebenkostenabrechnung_2025.pdf",
    "06_universitaet_information.pdf",
    "07_stadtwerke_abschlag_unscharf.jpg",
  ];
  const ids: Record<string, string> = {};
  for (const file of files) ids[file.slice(0, 2)] = await upload(cookieHeader, file);
  await waitFor(
    "processing of all letters",
    async () => {
      const rows = await sql`select status from documents where id = any(${Object.values(ids)})`;
      return rows.length === files.length && rows.every((row) => row.status === "needs_review");
    },
    240_000,
  );

  const browser = await chromium.launch();
  try {
    log("confirming letters 01, 03, 04 and 06 in Review");
    for (const key of ["01", "03", "04", "06"])
      await confirmInReview(browser, demo.cookies, ids[key]);
    await addFictionalRows(demo.id);

    const shots: Shot[] = [
      { file: "review.png", path: `/inbox/${ids["05"]}`, locale: "en", prepare: focusIban },
      { file: "overview.png", path: "/", locale: "en" },
      { file: "inbox.png", path: "/inbox", locale: "en" },
      { file: "tasks.png", path: "/tasks?filter=all", locale: "en" },
      { file: "workdays.png", path: "/work-days", locale: "en" },
      { file: "records.png", path: "/records", locale: "en" },
      {
        file: "review-dark.png",
        path: `/inbox/${ids["05"]}`,
        locale: "en",
        dark: true,
        prepare: focusIban,
      },
      { file: "overview-de.png", path: "/", locale: "de" },
    ];
    for (const shot of shots) await capture(browser, demo.cookies, shot);
  } finally {
    await browser.close();
  }
}

main()
  .then(async () => {
    await removeDemoUser();
    stopAll();
    log(`done: screenshots in ${OUT_DIR}`);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await removeDemoUser().catch(() => {});
    stopAll();
    process.exit(1);
  });
