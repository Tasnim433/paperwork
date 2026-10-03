import { getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/data/auto-refresh";
import { InboxTable } from "@/components/data/inbox-table";
import { Metrics } from "@/components/data/metrics";
import { SectionTitle } from "@/components/data/table";
import { TaskTable } from "@/components/data/task-table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { timeOfDay, todayIso } from "@/lib/dates";
import { firstName } from "@/lib/initials";
import { overviewMetrics, summaryKey } from "@/lib/summary";
import { activeStatuses, listInbox } from "@/server/queries/documents";
import { listTasks } from "@/server/queries/tasks";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("overview");

const COMING_UP_LIMIT = 5;

export default async function OverviewPage() {
  const { user } = await requireSession();
  const t = await getTranslations("overview");
  const [openTasks, inbox] = await Promise.all([listTasks(user.id, "open"), listInbox(user.id)]);

  const toReview = inbox.filter((doc) => doc.status === "needs_review").length;
  const metrics = overviewMetrics(openTasks, toReview, todayIso());

  return (
    <>
      <PageHeader
        title={t(`greeting.${timeOfDay()}`, { name: firstName(user.name) })}
        description={t.rich(`summary.${summaryKey(metrics)}`, {
          overdue: metrics.overdue,
          toReview: metrics.toReview,
          b: (chunks) => <b>{chunks}</b>,
        })}
      />
      <Metrics
        items={[
          { label: t("metrics.open"), value: metrics.open },
          {
            label: t("metrics.overdue"),
            value: metrics.overdue,
            tone: metrics.overdue > 0 ? "danger" : undefined,
          },
          { label: t("metrics.dueThisWeek"), value: metrics.dueThisWeek },
          { label: t("metrics.toReview"), value: metrics.toReview },
        ]}
      />
      <section className="mb-11">
        <SectionTitle>{t("comingUp")}</SectionTitle>
        <TaskTable tasks={openTasks.slice(0, COMING_UP_LIMIT)} />
      </section>
      <section className="mb-11">
        <SectionTitle>{t("waitingForReview")}</SectionTitle>
        <InboxTable documents={inbox} />
      </section>
      <AutoRefresh
        active={inbox.some((doc) => (activeStatuses as readonly string[]).includes(doc.status))}
      />
    </>
  );
}
