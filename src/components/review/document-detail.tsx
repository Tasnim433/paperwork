"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { isLocale, type Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { displayValue } from "@/lib/review";
import { documentFields, type DocumentTypeKey } from "@/lib/schemas/document-fields";
import type { DocumentDetail as Detail } from "@/server/queries/review";

const DocumentViewer = dynamic(() => import("./document-viewer").then((m) => m.DocumentViewer), {
  ssr: false,
  loading: () => <div className="aspect-[1/1.414] rounded-xl bg-muted" />,
});

/** Read-only view of a confirmed document: original, fields, and what it created. */
export function DocumentDetail({ data }: { data: Detail }) {
  const t = useTranslations();
  const rawLocale = useLocale();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "de";
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { document: doc } = data;
  const type: DocumentTypeKey = doc.type ?? "other";
  const definitions = documentFields[type];
  const labels = Object.fromEntries(
    definitions.map((d) => [d.key, t(`fields.${d.key}` as "fields.sender")]),
  );
  const valueOf = (key: string) => data.fields.find((field) => field.key === key);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/records">{t("review.back")}</Link>
        </Button>
        <p className="min-w-0 truncate text-muted-foreground">
          {t("nav.records")} /{" "}
          <span className="font-medium text-foreground">
            {doc.sender ?? doc.originalFileName} · {t(`documentType.${type}`)}
          </span>
        </p>
      </div>

      <div className="grid items-start gap-7 desktop:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <DocumentViewer
          fileUrl={`/api/documents/${doc.id}/file`}
          fileName={doc.originalFileName}
          mimeType={doc.mimeType}
          boxes={data.boxes}
          activeKey={activeKey}
          labels={labels}
          onBoxHover={setActiveKey}
          onBoxClick={setActiveKey}
        />

        <div className="rounded-xl border border-border bg-background">
          <section className="px-5 py-[18px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">{t("review.meta.received")}</dt>
              <dd>{formatDate(doc.receivedDate, locale)}</dd>
              <dt className="text-muted-foreground">{t("documentDetail.status")}</dt>
              <dd>
                <StatusDot tone={doc.status === "confirmed" ? "success" : "neutral"}>
                  {t(
                    `documentDetail.statuses.${doc.status === "confirmed" ? "confirmed" : "informationOnly"}`,
                  )}
                </StatusDot>
              </dd>
              <dt className="text-muted-foreground">{t("review.meta.file")}</dt>
              <dd className="truncate font-mono text-xs text-muted-foreground">
                {doc.originalFileName}
              </dd>
            </dl>
          </section>

          <section className="border-t border-border px-5 py-[18px]">
            <h3 className="mb-3 text-sm font-semibold">{t("review.sections.fields")}</h3>
            <dl className="flex flex-col">
              {definitions.map((definition) => {
                const field = valueOf(definition.key);
                return (
                  <div
                    key={definition.key}
                    onMouseEnter={() => setActiveKey(definition.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    className="grid grid-cols-[120px_1fr] gap-3 border-b border-line-2 py-[7px] text-[13px] last:border-b-0"
                  >
                    <dt className="text-ink-2">{labels[definition.key]}</dt>
                    <dd className="min-w-0 break-words">
                      {field?.value ? (
                        displayValue(definition.kind, field.value, locale)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {field?.edited && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("documentDetail.corrected")}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="border-t border-border px-5 py-[18px]">
            <h3 className="mb-3 text-sm font-semibold">{t("documentDetail.created")}</h3>
            {data.tasks.length === 0 && data.workEntries.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                {t("documentDetail.nothingCreated")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {data.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-line-2 py-[7px] text-[13px] last:border-b-0"
                  >
                    <span className="min-w-0">
                      {task.title}
                      {task.completionNote && (
                        <span className="block text-[12.5px] text-muted-foreground">
                          {t("tasks.notePrefix")} {task.completionNote}
                        </span>
                      )}
                    </span>
                    <StatusDot tone={task.status === "done" ? "success" : "neutral"}>
                      {task.status === "done"
                        ? t("documentDetail.taskDone")
                        : task.dueDate
                          ? formatDate(task.dueDate, locale)
                          : t("common.noDate")}
                    </StatusDot>
                  </li>
                ))}
                {data.workEntries.map((entry) => (
                  <li key={entry.month} className="py-[7px] text-[13px]">
                    {t("review.creates.workDays")}:{" "}
                    {t("review.creates.workDaysText", {
                      month: entry.month.slice(0, 7),
                      full: entry.fullDays,
                      half: entry.halfDays,
                    })}
                  </li>
                ))}
              </ul>
            )}
            {data.tasks.length > 0 && (
              <Link
                href="/tasks"
                className="mt-2 inline-block text-[13px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("documentDetail.openTasks")}
              </Link>
            )}
          </section>

          <section className="border-t border-border px-5 py-[18px]">
            <h3 className="mb-1.5 text-sm font-semibold">{t("review.sections.summary")}</h3>
            <p className="mb-1.5 text-xs text-muted-foreground">{t("review.generated")}</p>
            <p className="text-[13.5px] text-ink-2">{doc.summary ?? t("review.noSummary")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
