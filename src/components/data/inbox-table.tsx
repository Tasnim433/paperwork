import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { InboxRow } from "@/server/queries/documents";

import { RetryButton } from "./retry-button";
import { desktopOnly, EmptyState, Table, Td, Th } from "./table";

const errorCodes = [
  "unreadable",
  "rate_limited",
  "quota_exhausted",
  "queue_unavailable",
  "not_found",
  "unknown",
] as const;

async function InboxStatus({ doc }: { doc: InboxRow }) {
  const t = await getTranslations();

  switch (doc.status) {
    case "received":
      return (
        <StatusDot tone="brand" className="before:animate-pulse">
          {t("inboxStatus.queued")}
        </StatusDot>
      );
    case "processing":
      return (
        <StatusDot tone="brand" className="before:animate-pulse">
          {doc.processingStage ? t(`stage.${doc.processingStage}`) : t("inbox.status.processing")}
        </StatusDot>
      );
    case "failed": {
      const code = errorCodes.find((c) => c === doc.errorCode) ?? "unknown";
      return (
        <span className="flex flex-col gap-0.5">
          <StatusDot tone="danger">
            {doc.processingStage
              ? t("inboxStatus.failedAt", { stage: t(`stage.${doc.processingStage}`) })
              : t("inboxStatus.failed")}
          </StatusDot>
          <span className="pl-3.5 text-xs text-muted-foreground">
            {t(`inboxStatus.errors.${code}`)}
          </span>
        </span>
      );
    }
    default:
      return doc.flaggedCount > 0 ? (
        <StatusDot tone="warning">
          {t("inbox.status.fieldsToCheck", { count: doc.flaggedCount })}
        </StatusDot>
      ) : (
        <StatusDot tone="success">{t("inbox.status.ready")}</StatusDot>
      );
  }
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
          // Until the sender is extracted, show the file name.
          const label = doc.sender ?? (
            <span className="text-muted-foreground">{doc.originalFileName}</span>
          );
          return (
            <tr key={doc.id}>
              <Td className="whitespace-nowrap tabular-nums">
                {formatDate(doc.receivedDate, locale)}
              </Td>
              <Td className="max-w-[260px] truncate">
                {reviewable ? (
                  <Link href={`/inbox/${doc.id}`} className="hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
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
                {doc.status === "failed" && <RetryButton documentId={doc.id} />}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
