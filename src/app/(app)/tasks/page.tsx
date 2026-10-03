import { getTranslations } from "next-intl/server";

import { FilterTabs } from "@/components/data/filter-tabs";
import { TaskTable } from "@/components/data/task-table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { listTasks, parseTaskFilter, taskFilters } from "@/server/queries/tasks";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("tasks");

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const { user } = await requireSession();
  const t = await getTranslations();
  const filter = parseTaskFilter((await searchParams).filter);
  const tasks = await listTasks(user.id, filter);

  return (
    <>
      <PageHeader title={t("pages.tasks.title")} description={t("pages.tasks.description")} />
      <div className="mb-4">
        <FilterTabs
          label={t("tasks.filter.label")}
          tabs={taskFilters.map((value) => ({
            href: value === "open" ? "/tasks" : `/tasks?filter=${value}`,
            label: t(`tasks.filter.${value}`),
            active: value === filter,
          }))}
        />
      </div>
      <TaskTable tasks={tasks} />
    </>
  );
}
