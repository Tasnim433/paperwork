import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { InboxRow } from "@/server/queries/documents";

import { desktopOnly, EmptyState, Table, Td, Th } from "./table";

async function InboxStatus({ doc }: { doc: InboxRow }) {
  const t = await getTranslations("inbox.status");
  if (doc.status === "processing")
    return (
      <StatusDot tone="brand" className="before:animate-pulse">
        {t("processing")}
      </StatusDot>
    );
  if (doc.status === "received") return <StatusDot>{t("received")}</StatusDot>;
  if (doc.flaggedCount > 0)
    return <StatusDot tone="warning">{t("fieldsToCheck", { count: doc.flaggedCount })}</StatusDot>;
  return <StatusDot tone="success">{t("ready")}</StatusDot>;
}

export async function InboxTable({ documents }: { documents: InboxRow[] }) {
  const t = await getTranslations();
  const locale = await getLocale();

  if (documents.length === 0) return <EmptyState>{t("inbox.empty")}</EmptyState>;

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("inbox.columns.received")}</Th>
          <Th>{t("inbox.columns.sender")}</Th>
          <Th className={desktopOnly}>{t("inbox.columns.type")}</Th>
          <Th>{t("inbox.columns.status")}</Th>
          <Th>
            <span className="sr-only">{t("inbox.review")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => {
          const reviewable = doc.status === "needs_review";
          return (
            <tr key={doc.id}>
              <Td className="whitespace-nowrap tabular-nums">
                {formatDate(doc.receivedDate, locale)}
              </Td>
              <Td>
                {reviewable ? (
                  <Link href={`/inbox/${doc.id}`} className="hover:underline">
                    {doc.sender ?? t("common.unknownSender")}
                  </Link>
                ) : (
                  (doc.sender ?? <span className="text-muted-foreground">—</span>)
                )}
              </Td>
              <Td className={desktopOnly}>
                {doc.type ? (
                  t(`documentType.${doc.type}`)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td>
                <InboxStatus doc={doc} />
              </Td>
              <Td className="text-right">
                {reviewable && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/inbox/${doc.id}`}>{t("inbox.review")}</Link>
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
