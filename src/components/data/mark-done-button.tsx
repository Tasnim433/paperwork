"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { markTaskDone } from "@/server/actions/tasks";

function Submit() {
  const t = useTranslations("tasks");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {t("markDone")}
    </Button>
  );
}

export function MarkDoneButton({ taskId }: { taskId: string }) {
  return (
    <form action={markTaskDone.bind(null, taskId)}>
      <Submit />
    </form>
  );
}
