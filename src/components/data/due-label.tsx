import { getLocale, getTranslations } from "next-intl/server";

import { StatusDot } from "@/components/status-dot";
import { dueStatus, type IsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";

/** Status of a task's deadline: red when overdue, amber within 7 days, green when done. */
export async function DueLabel({
  task,
  today,
}: {
  task: { status: "open" | "done"; dueDate: IsoDate | null; completedAt: Date | null };
  today: IsoDate;
}) {
  const t = await getTranslations("due");
  const locale = await getLocale();
  const status = dueStatus(task, today);

  switch (status.kind) {
    case "done":
      return (
        <StatusDot tone="success">
          {t("done", { date: task.completedAt ? formatDate(task.completedAt, locale) : "" })}
        </StatusDot>
      );
    case "overdue":
      return <StatusDot tone="danger">{t("overdue", { days: status.days })}</StatusDot>;
    case "today":
      return <StatusDot tone="warning">{t("today")}</StatusDot>;
    case "soon":
      return <StatusDot tone="warning">{t("inDays", { days: status.days })}</StatusDot>;
    case "later":
      return <StatusDot>{t("inDays", { days: status.days })}</StatusDot>;
    case "none":
      return <StatusDot>{t("none")}</StatusDot>;
  }
}
