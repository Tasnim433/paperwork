import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { FilterTabs } from "@/components/data/filter-tabs";
import { desktopOnly, EmptyState, SectionTitle, Table, Td, Th } from "@/components/data/table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { ConfirmDeleteDialog } from "@/components/settings/confirm-delete-dialog";
import { ReminderOffsetsForm } from "@/components/settings/reminder-offsets-form";
import { RetentionSelect } from "@/components/settings/retention-select";
import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { shortId } from "@/lib/deletion";
import { formatDateTime } from "@/lib/format";
import { DELETE_DOCUMENTS_WORD } from "@/lib/settings";
import { deleteAccount, deleteAllDocuments } from "@/server/actions/settings";
import { reminderOffsets } from "@/server/queries/review";
import {
  auditActors,
  HISTORY_PAGE_SIZE,
  historyRetention,
  listHistory,
  parseActor,
  type HistoryEntry,
} from "@/server/queries/settings";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("settings");

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-1.5 border-b border-border py-4 desktop:grid-cols-[220px_1fr_auto] desktop:gap-5">
      <span className="font-medium">{label}</span>
      {description !== undefined && <span className="text-muted-foreground">{description}</span>}
      {children}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { user } = await requireSession();
  const t = await getTranslations("settings");
  const tAudit = await getTranslations("audit");
  const tFields = await getTranslations("fields");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "de";
  const params = await searchParams;
  const actor = parseActor(params.actor);
  const limit = Math.min(
    Math.max(Number(params.limit) || HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE),
    1000,
  );

  const [offsets, history, retention] = await Promise.all([
    reminderOffsets(user.id),
    listHistory(user.id, { actor, limit }),
    historyRetention(user.id),
  ]);

  const historyHref = (next: { actor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (next.actor) query.set("actor", next.actor);
    if (next.limit && next.limit > HISTORY_PAGE_SIZE) query.set("limit", String(next.limit));
    const string = query.toString();
    return `/settings${string ? `?${string}` : ""}#history`;
  };

  const actionLabel = (entry: HistoryEntry) => {
    if (entry.action === "document.deleted") {
      return tAudit("actions.document.deleted", { id: shortId(entry.entityId) });
    }
    const key = `actions.${entry.action}`;
    return tAudit.has(key as "actions.document.uploaded")
      ? tAudit(key as "actions.document.uploaded")
      : entry.action;
  };

  const objectLabel = (entry: HistoryEntry) => {
    const after = (entry.after ?? {}) as Record<string, unknown>;
    const before = (entry.before ?? {}) as Record<string, unknown>;
    switch (entry.entityType) {
      case "document":
        return (
          entry.documentSender ??
          entry.documentFileName ??
          (after.fileName as string) ??
          tAudit("entity.deletedDocument")
        );
      case "task":
        return entry.taskTitle ?? (after.title as string) ?? tAudit("entity.task");
      case "field": {
        const key = (after.key ?? before.key) as string | undefined;
        const label = key && tFields.has(key as "sender") ? tFields(key as "sender") : key;
        return label ?? tAudit("entity.field");
      }
      case "work_entry":
        return tAudit("entity.workEntry", { month: String(after.month ?? "") });
      default:
        return tAudit("entity.settings");
    }
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <section className="mb-11">
        <SectionTitle>{t("reminders.title")}</SectionTitle>
        <div className="border-t border-border">
          <Row label={t("reminders.schedule")}>
            <ReminderOffsetsForm key={offsets.join(",")} offsets={offsets} />
          </Row>
          <Row
            label={t("reminders.delivery")}
            description={t("reminders.deliveryValue", { email: user.email })}
          >
            <span />
          </Row>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("reminders.futureOnly")}</p>
      </section>

      <section className="mb-11">
        <SectionTitle>{t("delete.title")}</SectionTitle>
        <div className="border-t border-border">
          <Row label={t("delete.documents.label")} description={t("delete.documents.description")}>
            <ConfirmDeleteDialog
              kind="documents"
              expected={DELETE_DOCUMENTS_WORD[locale]}
              action={deleteAllDocuments}
            />
          </Row>
          <Row label={t("delete.account.label")} description={t("delete.account.description")}>
            <ConfirmDeleteDialog kind="account" expected={user.email} action={deleteAccount} />
          </Row>
        </div>
      </section>

      <section className="mb-11" id="history">
        <SectionTitle>{t("history.title")}</SectionTitle>
        <div className="mb-4 border-t border-border">
          <Row
            label={t("history.retention.label")}
            description={t("history.retention.description")}
          >
            <RetentionSelect months={retention} />
          </Row>
        </div>
        <div className="mb-4">
          <FilterTabs
            label={t("history.filterLabel")}
            tabs={[undefined, ...auditActors].map((value) => ({
              href: historyHref({ actor: value }),
              label: value ? tAudit(`actors.${value}`) : t("history.allActors"),
              active: value === actor,
            }))}
          />
        </div>
        {history.entries.length === 0 ? (
          <EmptyState>{t("history.empty")}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("history.columns.time")}</Th>
                <Th>{t("history.columns.actor")}</Th>
                <Th>{t("history.columns.action")}</Th>
                <Th className={desktopOnly}>{t("history.columns.object")}</Th>
              </tr>
            </thead>
            <tbody>
              {history.entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {formatDateTime(entry.createdAt, locale)}
                  </Td>
                  <Td>{tAudit(`actors.${entry.actor}`)}</Td>
                  <Td>{actionLabel(entry)}</Td>
                  <Td className={`${desktopOnly} max-w-[320px] truncate text-muted-foreground`}>
                    {objectLabel(entry)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {history.hasMore && (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={historyHref({ actor, limit: limit + HISTORY_PAGE_SIZE })} scroll={false}>
              {t("history.more")}
            </Link>
          </Button>
        )}
      </section>
    </>
  );
}
