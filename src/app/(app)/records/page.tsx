import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { FilterTabs } from "@/components/data/filter-tabs";
import { ManualWorkDaysDialog } from "@/components/data/manual-work-days-dialog";
import { RecordsSearch } from "@/components/data/records-search";
import { DocumentRowMenu } from "@/components/documents/document-row-menu";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/documents/selection";
import { desktopOnly, EmptyState, Table, Td, Th } from "@/components/data/table";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { pageMetadata } from "@/components/placeholder-page";
import { needsManualWorkDays } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { periodMonth } from "@/lib/work-days";
import type { DocumentType } from "@/server/db/schema";
import { listRecords, listRecordTypes, parseDocumentType } from "@/server/queries/documents";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("records");

function recordsHref(type: DocumentType | undefined, q: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/records?${query}` : "/records";
}

export default async function RecordsPage({ searchParams }: PageProps<"/records">) {
  const { user } = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();
  const params = await searchParams;
  const type = parseDocumentType(params.type);
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";

  const [records, types] = await Promise.all([
    listRecords(user.id, { type, q }),
    listRecordTypes(user.id),
  ]);

  return (
    <>
      <PageHeader title={t("pages.records.title")} description={t("pages.records.description")} />
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <RecordsSearch q={q} type={type} />
        <FilterTabs
          label={t("records.filterLabel")}
          tabs={[undefined, ...types].map((value) => ({
            href: recordsHref(value, q),
            label: value ? t(`documentType.${value}`) : t("records.allTypes"),
            active: value === type,
          }))}
        />
      </div>

      {records.length === 0 ? (
        <EmptyState>{t("records.empty")}</EmptyState>
      ) : (
        <SelectionProvider ids={records.map((record) => record.id)} kind="record">
          <Table>
            <thead>
              <tr>
                <Th className="w-8">
                  <SelectAllCheckbox />
                </Th>
                <Th>{t("records.columns.date")}</Th>
                <Th>{t("records.columns.sender")}</Th>
                <Th>{t("records.columns.type")}</Th>
                <Th className={desktopOnly}>{t("records.columns.reference")}</Th>
                <Th className="text-right">{t("records.columns.tasks")}</Th>
                <Th className="w-10">
                  <span className="sr-only">{t("documents.actions")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <Td className="w-8">
                    <RowCheckbox
                      id={record.id}
                      label={record.sender ?? t("common.unknownSender")}
                    />
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(record.receivedDate, locale)}
                  </Td>
                  <Td>
                    <Link
                      href={`/records/${record.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {record.sender ?? t("common.unknownSender")}
                    </Link>
                  </Td>
                  <Td>
                    {t(`documentType.${record.type ?? "unknown"}`)}
                    {needsManualWorkDays(record) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusDot tone="warning" className="text-[12.5px]">
                          {t("workDays.notStated")}
                        </StatusDot>
                        <ManualWorkDaysDialog
                          documentId={record.id}
                          defaultMonth={periodMonth(record.period)}
                        />
                      </div>
                    )}
                  </Td>
                  <Td className={`${desktopOnly} font-mono text-xs text-muted-foreground`}>
                    {record.reference ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{record.taskCount}</Td>
                  <Td className="w-10 text-right">
                    <DocumentRowMenu
                      documentId={record.id}
                      label={record.sender ?? t("common.unknownSender")}
                      kind="record"
                      canReplace={false}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SelectionProvider>
      )}
    </>
  );
}
