"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/components/upload/upload-provider";
import { isLocale, type Locale } from "@/i18n/config";
import { todayIso } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { canAccept, canConfirm, displayValue, documentChecks, validateReview } from "@/lib/review";
import { tasksForDocument, type PlannedAction } from "@/lib/task-rules";
import { documentFields, documentTypes, type DocumentTypeKey } from "@/lib/schemas/document-fields";
import { parseAmountCents } from "@/lib/validation/parse";
import type { FieldState } from "@/lib/validation/validate-document";
import { cn } from "@/lib/utils";
import {
  confirmDocument,
  markInformationOnly,
  reprocessDocument,
  saveDraft,
  type ReviewActionResult,
} from "@/server/actions/review";
import type { ReviewData } from "@/server/queries/review";

// The viewer uses pdf.js and canvas: browser only.
const DocumentViewer = dynamic(() => import("./document-viewer").then((m) => m.DocumentViewer), {
  ssr: false,
  loading: () => <div className="aspect-[1/1.414] rounded-xl bg-muted" />,
});

const stateTone: Record<FieldState, "success" | "warning" | "danger"> = {
  valid: "success",
  check: "warning",
  missing: "danger",
};

export function ReviewScreen({ data }: { data: ReviewData }) {
  const t = useTranslations();
  const router = useRouter();
  const rawLocale = useLocale();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "de";
  const { notify } = useUpload();
  const { document: doc, stored, boxes, duplicate, queue } = data;

  const [type, setType] = useState<DocumentTypeKey>(doc.type ?? "other");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const definitions of Object.values(documentFields)) {
      for (const definition of definitions) {
        const field = stored.find((s) => s.key === definition.key);
        initial[definition.key] ??= displayValue(definition.kind, field?.value ?? null, locale);
      }
    }
    return initial;
  });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reprocessArmed, setReprocessArmed] = useState(false);
  /** Fields whose value the user accepted as it is (only "compare with the original" flags). */
  const [accepted, setAccepted] = useState<string[]>([]);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const definitions = documentFields[type];
  const results = useMemo(
    () => validateReview(type, stored, values, locale, accepted),
    [type, stored, values, locale, accepted],
  );
  const resultByKey = useMemo(() => new Map(results.map((r) => [r.key, r])), [results]);
  const validCount = results.filter((r) => r.state === "valid").length;
  const checks = documentChecks(results, duplicate);
  const confirmable = canConfirm(results, duplicate);
  const actions = useMemo(
    () =>
      tasksForDocument(type, results, {
        reminderOffsetDays: data.reminderOffsetDays,
        today: todayIso(),
        textMentionsDirectDebit: data.textMentionsDirectDebit,
      }),
    [type, results, data.reminderOffsetDays, data.textMentionsDirectDebit],
  );
  const labels = Object.fromEntries(
    definitions.map((d) => [d.key, t(`fields.${d.key}` as "fields.sender")]),
  );
  const visibleBoxes = boxes.filter((box) => definitions.some((d) => d.key === box.key));

  const input = (): Parameters<typeof saveDraft>[0] => ({
    documentId: doc.id,
    type,
    values: Object.fromEntries(definitions.map((d) => [d.key, values[d.key] ?? ""])),
    accepted,
  });

  const handleResult = useCallback(
    (result: ReviewActionResult, success: string, leave: boolean) => {
      if (!result.ok) {
        notify(t(`review.messages.${result.error}`), "danger");
        return;
      }
      notify(success);
      if (leave) router.push(result.next ? `/inbox/${result.next}` : "/inbox");
      else router.refresh();
    },
    [notify, router, t],
  );

  const run = useCallback(
    (
      action: () => Promise<ReviewActionResult>,
      success: (r: ReviewActionResult) => string,
      leave: boolean,
    ) =>
      startTransition(async () => {
        try {
          const result = await action();
          handleResult(result, success(result), leave);
        } catch {
          notify(t("review.messages.failed"), "danger");
        }
      }),
    [handleResult, notify, t],
  );

  const confirm = useCallback(() => {
    if (!confirmable || pending) return;
    run(
      () => confirmDocument(input()),
      (r) => t("review.messages.confirmed", { count: r.ok ? (r.created ?? 0) : 0 }),
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- input() reads current state
  }, [confirmable, pending, run, t, type, values, accepted]);

  const accept = (key: string) =>
    setAccepted((current) => (current.includes(key) ? current : [...current, key]));

  const focusField = (key: string) => {
    const element = inputs.current.get(key);
    element?.focus();
    element?.select();
  };

  const focusNextOpen = (fromKey: string) => {
    const order = definitions.map((d) => d.key);
    const start = order.indexOf(fromKey);
    const rotated = [...order.slice(start + 1), ...order.slice(0, start + 1)];
    const next = rotated.find((key) => resultByKey.get(key)?.state !== "valid");
    if (next && next !== fromKey) focusField(next);
  };

  // Focus the first field that needs attention when a document opens.
  useEffect(() => {
    const first = results.find((r) => r.state !== "valid");
    if (first) setTimeout(() => inputs.current.get(first.key)?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [doc.id]);

  // Keyboard: Ctrl/Cmd+Enter confirms, J/K move through the queue.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        confirm();
        return;
      }
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "j" && queue.next) router.push(`/inbox/${queue.next}`);
      if (event.key === "k" && queue.previous) router.push(`/inbox/${queue.previous}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, queue.next, queue.previous, router]);

  const activeKey = focusedKey ?? hoveredKey;
  const progress = results.length ? (validCount / results.length) * 100 : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/inbox">{t("review.back")}</Link>
        </Button>
        <p className="min-w-0 truncate text-muted-foreground">
          {t("nav.inbox")} /{" "}
          <span className="font-medium text-foreground">
            {doc.sender ?? doc.originalFileName} · {t(`documentType.${type}`)}
          </span>
        </p>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <span>{t("review.progress", { valid: validCount, total: results.length })}</span>
          <div className="h-[3px] w-[110px] overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-brand transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <QueueLink id={queue.previous} label={t("review.previous")} shortcut="K" />
        <QueueLink id={queue.next} label={t("review.next")} shortcut="J" />
      </div>

      <div className="grid items-start gap-7 desktop:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <DocumentViewer
          fileUrl={`/api/documents/${doc.id}/file`}
          fileName={doc.originalFileName}
          mimeType={doc.mimeType}
          boxes={visibleBoxes}
          activeKey={activeKey}
          labels={labels}
          onBoxHover={setHoveredKey}
          onBoxClick={focusField}
        />

        <div>
          <div className="rounded-xl border border-border bg-background">
            <Section>
              <dl className="grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1 text-[13px]">
                <dt className="text-muted-foreground">{t("review.meta.sender")}</dt>
                <dd>{doc.sender ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("review.meta.received")}</dt>
                <dd>{formatDate(doc.receivedDate, locale)}</dd>
                <dt className="text-muted-foreground">{t("review.meta.file")}</dt>
                <dd className="truncate font-mono text-xs text-muted-foreground">
                  {doc.originalFileName}
                </dd>
              </dl>
            </Section>

            <Section number={1} title={t("review.sections.type")}>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as DocumentTypeKey)}
                aria-label={t("review.sections.type")}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {documentTypes.map((value) => (
                  <option key={value} value={value}>
                    {t(`documentType.${value}`)}
                  </option>
                ))}
              </select>
            </Section>

            <Section
              number={2}
              title={t("review.sections.fields")}
              aside={
                <span className="text-xs text-muted-foreground">
                  {results.length - validCount > 0
                    ? t("review.toResolve", { count: results.length - validCount })
                    : t("review.allValid")}
                </span>
              }
            >
              <div className="flex flex-col">
                {definitions.map((definition) => {
                  const result = resultByKey.get(definition.key);
                  const state = result?.state ?? "missing";
                  const id = `field-${definition.key}`;
                  const hintId = `${id}-hint`;
                  return (
                    <div
                      key={definition.key}
                      onMouseEnter={() => setHoveredKey(definition.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-1.5 desktop:grid-cols-[120px_1fr_72px]"
                    >
                      <label
                        htmlFor={id}
                        className="col-span-2 text-[13px] text-ink-2 desktop:col-span-1"
                      >
                        {labels[definition.key]}
                      </label>
                      <input
                        id={id}
                        ref={(element) => {
                          if (element) inputs.current.set(definition.key, element);
                          else inputs.current.delete(definition.key);
                        }}
                        value={values[definition.key] ?? ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [definition.key]: event.target.value,
                          }))
                        }
                        onFocus={() => setFocusedKey(definition.key)}
                        onBlur={() => setFocusedKey((key) => (key === definition.key ? null : key))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !(event.ctrlKey || event.metaKey)) {
                            event.preventDefault();
                            if (canAccept(result?.rule)) accept(definition.key);
                            focusNextOpen(definition.key);
                          }
                        }}
                        placeholder={
                          state === "missing" ? t("review.missingPlaceholder") : undefined
                        }
                        aria-invalid={state !== "valid"}
                        aria-describedby={result?.rule ? hintId : undefined}
                        className={cn(
                          "h-9 w-full min-w-0 rounded-lg border bg-background px-2.5 text-[13.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                          state === "valid" && "border-input focus-visible:border-ring",
                          state === "check" && "border-warning",
                          state === "missing" && "border-danger",
                        )}
                      />
                      <StatusDot tone={stateTone[state]} className="justify-self-end">
                        {t(`review.state.${state}`)}
                      </StatusDot>
                      {result?.rule && (
                        <p
                          id={hintId}
                          className={cn(
                            "col-span-2 -mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs desktop:col-start-2 desktop:col-end-4",
                            state === "missing" ? "text-danger" : "text-warning",
                          )}
                        >
                          {t(`review.rules.${result.rule}` as "review.rules.required")}
                          {canAccept(result.rule) && (
                            <button
                              type="button"
                              onClick={() => accept(definition.key)}
                              className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                            >
                              {t("review.accept")}
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section number={3} title={t("review.sections.checks")}>
              <ul className="flex flex-col">
                {checks.map((check) => (
                  <li key={check.key} className="flex justify-between gap-3 py-[5px] text-[13px]">
                    <span>{t(`review.checks.${check.key}`)}</span>
                    {check.passed ? (
                      <StatusDot tone="success">{t("review.checks.passed")}</StatusDot>
                    ) : (
                      <StatusDot tone="danger">{t("review.checks.failed")}</StatusDot>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            <Section number={4} title={t("review.sections.creates")}>
              <ul className="flex flex-col">
                {actions.flatMap((action, i) => (
                  <CreatesRows key={i} action={action} locale={locale} />
                ))}
              </ul>
            </Section>

            <Section number={5} title={t("review.sections.summary")}>
              <p className="mb-1.5 text-xs text-muted-foreground">{t("review.generated")}</p>
              <p className="text-[13.5px] text-ink-2">{doc.summary ?? t("review.noSummary")}</p>
            </Section>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
              <Button onClick={confirm} disabled={!confirmable || pending}>
                {t("review.actions.confirm")}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => saveDraft(input()),
                    () => t("review.messages.saved"),
                    false,
                  )
                }
              >
                {t("review.actions.saveDraft")}
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(
                    () => markInformationOnly(input()),
                    () => t("review.messages.informationOnly"),
                    true,
                  )
                }
              >
                {t("review.actions.informationOnly")}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                className={cn(reprocessArmed && "text-danger")}
                onClick={() => {
                  if (!reprocessArmed) {
                    setReprocessArmed(true);
                    setTimeout(() => setReprocessArmed(false), 4000);
                    return;
                  }
                  setReprocessArmed(false);
                  run(
                    () => reprocessDocument(doc.id),
                    () => t("review.messages.reprocessing"),
                    true,
                  );
                }}
              >
                {reprocessArmed
                  ? t("review.actions.reprocessConfirm")
                  : t("review.actions.reprocess")}
              </Button>
            </div>
          </div>

          <p className="mt-3.5 flex flex-wrap gap-3.5 text-xs text-muted-foreground">
            <span>
              <Kbd>Tab</Kbd> {t("review.hints.tab")}
            </span>
            <span>
              <Kbd>Enter</Kbd> {t("review.hints.enter")}
            </span>
            <span>
              <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> {t("review.hints.confirm")}
            </span>
            <span>
              <Kbd>J</Kbd>/<Kbd>K</Kbd> {t("review.hints.nav")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  aside,
  children,
}: {
  number?: number;
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-5 py-[18px] first:border-t-0">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {number !== undefined && (
              <span className="mr-2 font-normal text-muted-foreground tabular-nums">{number}</span>
            )}
            {title}
          </h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function QueueLink({
  id,
  label,
  shortcut,
}: {
  id: string | null;
  label: string;
  shortcut: string;
}) {
  if (!id) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" title={`${label} (${shortcut})`}>
      <Link href={`/inbox/${id}`}>{label}</Link>
    </Button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border px-[5px] font-mono text-[11px] text-ink-2">
      {children}
    </kbd>
  );
}

function CreatesRows({ action, locale }: { action: PlannedAction; locale: Locale }) {
  const t = useTranslations("review.creates");
  const date = (value: string | null) => (value ? formatDate(value, locale) : t("noDate"));
  const row = (tag: string, text: string, when: string, key?: string) => (
    <li
      key={key}
      className="grid grid-cols-[84px_1fr_auto] gap-2.5 border-b border-line-2 py-[7px] text-[13px] last:border-b-0"
    >
      <span className="text-[12.5px] text-muted-foreground">{tag}</span>
      <span className="min-w-0">{text}</span>
      <span className="text-muted-foreground tabular-nums">{when}</span>
    </li>
  );

  if (action.kind === "record") return row(t("record"), t("recordText"), "");
  if (action.kind === "note") return row(t("note"), t(`notes.${action.reason}`), "");
  if (action.kind === "workDays") {
    return row(
      t("workDays"),
      t("workDaysText", { month: action.month, full: action.fullDays, half: action.halfDays }),
      "",
    );
  }

  const values = { ...action.values };
  if (action.amountCents !== null) values.amount = formatCurrency(action.amountCents, locale);
  else if (values.amount) {
    const cents = parseAmountCents(values.amount);
    if (cents !== null) values.amount = formatCurrency(cents, locale);
  }
  const rows = [
    row(
      t(`kinds.${action.taskKind}`),
      t(`titles.${action.title}`, values),
      date(action.dueDate),
      "task",
    ),
  ];
  if (action.reminders.length > 0) {
    rows.push(
      row(t("reminders"), "", action.reminders.map((d) => date(d)).join(", "), "reminders"),
    );
  }
  return <>{rows}</>;
}
