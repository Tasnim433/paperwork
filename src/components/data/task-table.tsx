import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { formatCurrency, formatDate } from "@/lib/format";
import { todayIso } from "@/lib/dates";
import { documentHref } from "@/lib/documents";
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
              {task.completionNote && (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {t("tasks.notePrefix")} {task.completionNote}
                </p>
              )}
            </Td>
            <Td className={`${desktopOnly} text-muted-foreground`}>{t(`taskKind.${task.kind}`)}</Td>
            <Td className="whitespace-nowrap tabular-nums">
              {task.dueDate ? formatDate(task.dueDate, locale) : t("common.noDate")}
            </Td>
            <Td>
              <DueLabel task={task} today={today} />
            </Td>
            <Td className={`${desktopOnly} text-muted-foreground`}>
              {task.documentId && task.documentStatus ? (
                <Link
                  href={documentHref({ id: task.documentId, status: task.documentStatus })}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {task.sender ?? t("tasks.openDocument")}
                </Link>
              ) : (
                "—"
              )}
            </Td>
            <Td className="text-right">
              {task.status === "open" && <MarkDoneButton taskId={task.id} title={task.title} />}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
