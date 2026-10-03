import { getLocale, getTranslations } from "next-intl/server";

import { formatCurrency, formatDate } from "@/lib/format";
import { todayIso } from "@/lib/dates";
import type { TaskRow } from "@/server/queries/tasks";

import { DueLabel } from "./due-label";
import { MarkDoneButton } from "./mark-done-button";
import { desktopOnly, EmptyState, Table, Td, Th } from "./table";

export async function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const today = todayIso();

  if (tasks.length === 0) return <EmptyState>{t("tasks.empty")}</EmptyState>;

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("tasks.columns.task")}</Th>
          <Th className={desktopOnly}>{t("tasks.columns.type")}</Th>
          <Th>{t("tasks.columns.due")}</Th>
          <Th>{t("tasks.columns.status")}</Th>
          <Th className={desktopOnly}>{t("tasks.columns.source")}</Th>
          <Th>
            <span className="sr-only">{t("tasks.markDone")}</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <Td>
              {task.title}
              {task.amountCents !== null && (
                <span className="text-muted-foreground tabular-nums">
                  {" · "}
                  {formatCurrency(task.amountCents, locale)}
                </span>
              )}
            </Td>
            <Td className={`${desktopOnly} text-muted-foreground`}>{t(`taskKind.${task.kind}`)}</Td>
            <Td className="whitespace-nowrap tabular-nums">
              {task.dueDate ? formatDate(task.dueDate, locale) : t("common.noDate")}
            </Td>
            <Td>
              <DueLabel task={task} today={today} />
            </Td>
            <Td className={`${desktopOnly} text-muted-foreground`}>{task.sender ?? "—"}</Td>
            <Td className="text-right">
              {task.status === "open" && <MarkDoneButton taskId={task.id} />}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
