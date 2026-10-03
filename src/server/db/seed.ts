/**
 * Seeds fictional demo data (matching docs/design/mockup.html) for one user.
 *
 *   pnpm db:seed --email you@example.com [--name "Alex Muster"] [--password secret123]
 *
 * Creates the user if it does not exist. Replaces all existing app data of that user.
 * Dates are relative to today so there is always one overdue task.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { addDays, todayIso, type IsoDate } from "@/lib/dates";

import { auth } from "../auth";
import { db } from "./index";
import {
  auditLog,
  documents,
  extractedFields,
  reminders,
  tasks,
  userSettings,
  users,
  workEntries,
  type DocumentStatus,
  type DocumentType,
  type FieldState,
  type TaskKind,
} from "./schema";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string", default: "Demo Student" },
    password: { type: "string" },
  },
});

if (!args.email) {
  console.error("Usage: pnpm db:seed --email you@example.com [--name ...] [--password ...]");
  process.exit(1);
}

const email = args.email.trim().toLowerCase();
const today = todayIso();
const day = (offset: number) => addDays(today, offset);
const at = (date: IsoDate, time = "09:00") => new Date(`${date}T${time}:00+02:00`);

async function ensureUser() {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { user: existing, password: null };

  const password = args.password ?? randomBytes(9).toString("base64url");
  const { user } = await auth.api.signUpEmail({ body: { email, password, name: args.name! } });
  return { user, password };
}

type FieldSeed = {
  key: string;
  value: string | null;
  state: FieldState;
  sourceText?: string;
  confidence?: number;
};

type TaskSeed = {
  kind: TaskKind;
  title: string;
  dueDate: IsoDate;
  amountCents?: number;
  doneOn?: IsoDate;
};

type DocumentSeed = {
  slug: string;
  status: DocumentStatus;
  type: DocumentType | null;
  file: string;
  sender: string | null;
  received: IsoDate;
  summary?: string;
  fields?: FieldSeed[];
  tasks?: TaskSeed[];
};

const valid = (key: string, value: string, sourceText = value): FieldSeed => ({
  key,
  value,
  state: "valid",
  sourceText,
  confidence: 0.97,
});

const demoDocuments: DocumentSeed[] = [
  // Waiting for review
  {
    slug: "musterkasse-invoice",
    status: "needs_review",
    type: "invoice",
    file: `scan_${day(-1)}.pdf`,
    sender: "Musterkasse Krankenversicherung",
    received: day(-1),
    summary:
      "This is the invoice for your student health and long-term care insurance for the winter semester. Payment is mandatory. Use your insurance number as the payment reference.",
    fields: [
      valid("sender", "Musterkasse Krankenversicherung"),
      valid("letter_date", day(-4)),
      valid("period", "2026-10-01 – 2027-03-31", "01.10.2026 bis 31.03.2027"),
      valid("amount", "132.48", "132,48 €"),
      valid("due_date", day(43)),
      {
        key: "reference",
        value: "X1234S6789",
        state: "check",
        sourceText: "X1234S6789",
        confidence: 0.61,
      },
    ],
  },
  {
    slug: "auslaenderbehoerde-appointment",
    status: "needs_review",
    type: "appointment",
    file: "letter_photo.jpg",
    sender: "Stadt Musterstadt, Ausländerbehörde",
    received: day(-2),
    summary:
      "You have an appointment at the foreigners' office to extend your residence permit. Bring the three listed documents. If you cannot attend, you must cancel in advance.",
    fields: [
      valid("sender", "Stadt Musterstadt, Ausländerbehörde"),
      valid("appointment_date", day(19)),
      { key: "time", value: "09:3O", state: "check", sourceText: "09:3O Uhr", confidence: 0.54 },
      valid("location", "Room 2.14, Rathausplatz 2", "Zimmer 2.14, Rathausplatz 2"),
      valid("bring", "Passport, enrolment certificate, rental contract"),
      { key: "case_number", value: null, state: "missing", confidence: 0 },
    ],
  },
  {
    slug: "payslip-current",
    status: "processing",
    type: null,
    file: "payslip_sep.pdf",
    sender: null,
    received: today,
  },
  // Records
  {
    slug: "payslip-august",
    status: "confirmed",
    type: "payslip",
    file: "payslip_aug.pdf",
    sender: "Café Am Inn GmbH",
    received: day(-31),
    fields: [valid("reference", "08/2026"), valid("full_days", "9"), valid("half_days", "6")],
    tasks: [{ kind: "submit", title: "Send tax ID to Café Am Inn", dueDate: day(5) }],
  },
  {
    slug: "utility-back-payment",
    status: "confirmed",
    type: "invoice",
    file: "nebenkosten_2025.pdf",
    sender: "Hausverwaltung Muster",
    received: day(-9),
    fields: [valid("reference", "NK-2025-17"), valid("amount", "86.20", "86,20 €")],
    tasks: [
      { kind: "pay", title: "Pay utility back-payment", dueDate: day(28), amountCents: 8620 },
    ],
  },
  {
    slug: "broadcasting-fee",
    status: "confirmed",
    type: "invoice",
    file: "beitragsservice.pdf",
    sender: "Beitragsservice",
    received: day(-5),
    fields: [valid("reference", "482 113 907"), valid("amount", "55.08", "55,08 €")],
    tasks: [{ kind: "pay", title: "Pay broadcasting fee", dueDate: day(12), amountCents: 5508 }],
  },
  {
    slug: "enrolment-request",
    status: "confirmed",
    type: "other",
    file: "musterkasse_anforderung.pdf",
    sender: "Musterkasse Krankenversicherung",
    received: day(-13),
    fields: [valid("reference", "X123456789")],
    tasks: [
      { kind: "submit", title: "Submit enrolment certificate to Musterkasse", dueDate: day(-2) },
    ],
  },
  {
    slug: "rental-contract",
    status: "confirmed",
    type: "contract",
    file: "mietvertrag.pdf",
    sender: "Hausverwaltung Muster",
    received: day(-185),
    fields: [valid("reference", "MV-0412")],
    tasks: [
      {
        kind: "respond",
        title: "Return signed rental contract",
        dueDate: day(-178),
        doneOn: day(-180),
      },
    ],
  },
  {
    slug: "semester-fee",
    status: "confirmed",
    type: "invoice",
    file: "semesterbeitrag.pdf",
    sender: "Universität Musterstadt",
    received: day(-23),
    fields: [valid("reference", "WS26-88"), valid("amount", "88.00", "88,00 €")],
    tasks: [
      {
        kind: "pay",
        title: "Pay semester fee",
        dueDate: day(-18),
        amountCents: 8800,
        doneOn: day(-21),
      },
    ],
  },
  {
    slug: "semester-information",
    status: "information_only",
    type: "information_only",
    file: "semesterinfo.pdf",
    sender: "Universität Musterstadt",
    received: day(-40),
    summary: "General information about the start of the winter semester. No action required.",
  },
];

/** Full and half days per month, January to August (from the mockup). */
const workMonths: Array<[full: number, half: number]> = [
  [2, 1],
  [1, 1],
  [0, 2],
  [2, 3],
  [2, 3],
  [1, 3],
  [2, 2],
  [9, 6],
];

async function main() {
  const { user, password } = await ensureUser();
  const userId = user.id;

  // Remove existing app data; child rows cascade from documents and tasks.
  await db.batch([
    db.delete(auditLog).where(eq(auditLog.userId, userId)),
    db.delete(workEntries).where(eq(workEntries.userId, userId)),
    db.delete(tasks).where(eq(tasks.userId, userId)),
    db.delete(documents).where(eq(documents.userId, userId)),
  ]);

  const documentRows: (typeof documents.$inferInsert)[] = [];
  const fieldRows: (typeof extractedFields.$inferInsert)[] = [];
  const taskRows: (typeof tasks.$inferInsert)[] = [];
  const reminderRows: (typeof reminders.$inferInsert)[] = [];
  const auditRows: (typeof auditLog.$inferInsert)[] = [];
  const documentIds = new Map<string, string>();

  for (const doc of demoDocuments) {
    const documentId = randomUUID();
    documentIds.set(doc.slug, documentId);
    documentRows.push({
      id: documentId,
      userId,
      status: doc.status,
      type: doc.type,
      originalFileName: doc.file,
      mimeType: doc.file.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
      storageKey: `demo/${userId}/${documentId}`,
      sha256: createHash("sha256").update(`${userId}:${doc.slug}`).digest("hex"),
      sender: doc.sender,
      receivedDate: doc.received,
      summary: doc.summary ?? null,
      createdAt: at(doc.received, "08:30"),
    });
    auditRows.push({
      userId,
      actor: "system",
      action: "document.received",
      entityType: "document",
      entityId: documentId,
      after: { fileName: doc.file, via: "upload" },
      createdAt: at(doc.received, "08:30"),
    });

    for (const field of doc.fields ?? []) {
      fieldRows.push({
        userId,
        documentId,
        key: field.key,
        value: field.value,
        originalValue: field.value,
        confidence: field.confidence ?? null,
        state: field.state,
        sourcePage: field.value === null ? null : 1,
        sourceText: field.sourceText ?? null,
      });
    }
    if (doc.fields?.length) {
      auditRows.push({
        userId,
        actor: "ai",
        action: "document.extracted",
        entityType: "document",
        entityId: documentId,
        after: {
          fields: doc.fields.length,
          flagged: doc.fields.filter((f) => f.state !== "valid").length,
        },
        createdAt: at(doc.received, "08:31"),
      });
    }

    for (const task of doc.tasks ?? []) {
      const taskId = randomUUID();
      taskRows.push({
        id: taskId,
        userId,
        documentId,
        kind: task.kind,
        title: task.title,
        dueDate: task.dueDate,
        amountCents: task.amountCents ?? null,
        status: task.doneOn ? "done" : "open",
        completedAt: task.doneOn ? at(task.doneOn, "11:02") : null,
      });
      for (const offset of [7, 3, 1]) {
        const sendDate = addDays(task.dueDate, -offset);
        if (sendDate <= doc.received) continue;
        reminderRows.push({
          userId,
          taskId,
          sendAt: at(sendDate, "08:00"),
          sentAt: sendDate <= today ? at(sendDate, "08:00") : null,
        });
      }
      auditRows.push({
        userId,
        actor: "user",
        action: "document.confirmed",
        entityType: "document",
        entityId: documentId,
        after: { createdTasks: [taskId] },
        createdAt: at(doc.received, "20:40"),
      });
      if (task.doneOn) {
        auditRows.push({
          userId,
          actor: "user",
          action: "task.completed",
          entityType: "task",
          entityId: taskId,
          before: { status: "open" },
          after: { status: "done" },
          createdAt: at(task.doneOn, "11:02"),
        });
      }
    }
  }

  const year = today.slice(0, 4);
  const workRows: (typeof workEntries.$inferInsert)[] = workMonths.map(([full, half], i) => ({
    userId,
    documentId: i === 7 ? documentIds.get("payslip-august") : null,
    month: `${year}-${String(i + 1).padStart(2, "0")}-01`,
    fullDays: full,
    halfDays: half,
    hours: String(full * 6 + half * 3.5),
  }));

  await db.batch([
    db.insert(documents).values(documentRows),
    db.insert(extractedFields).values(fieldRows),
    db.insert(tasks).values(taskRows),
    db.insert(reminders).values(reminderRows),
    db.insert(workEntries).values(workRows),
    db.insert(auditLog).values(auditRows),
    db.insert(userSettings).values({ userId }).onConflictDoNothing(),
  ]);

  console.log(`Seeded demo data for ${email}:`);
  console.log(
    `  ${documentRows.length} documents, ${fieldRows.length} fields, ${taskRows.length} tasks, ` +
      `${reminderRows.length} reminders, ${workRows.length} work entries, ${auditRows.length} audit entries`,
  );
  if (password) console.log(`  Created user. Password: ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
