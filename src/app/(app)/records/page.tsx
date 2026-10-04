import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { FilterTabs } from "@/components/data/filter-tabs";
import { RecordsSearch } from "@/components/data/records-search";
import { desktopOnly, EmptyState, Table, Td, Th } from "@/components/data/table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { formatDate } from "@/lib/format";
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
        <Table>
          <thead>
            <tr>
              <Th>{t("records.columns.date")}</Th>
              <Th>{t("records.columns.sender")}</Th>
              <Th>{t("records.columns.type")}</Th>
              <Th className={desktopOnly}>{t("records.columns.reference")}</Th>
              <Th className="text-right">{t("records.columns.tasks")}</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
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
                <Td>{t(`documentType.${record.type ?? "unknown"}`)}</Td>
                <Td className={`${desktopOnly} font-mono text-xs text-muted-foreground`}>
                  {record.reference ?? "—"}
                </Td>
                <Td className="text-right tabular-nums">{record.taskCount}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
