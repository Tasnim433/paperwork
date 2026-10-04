"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpload } from "@/components/upload/upload-provider";
import { MAX_TASK_NOTE_LENGTH } from "@/lib/task-rules";
import { markTaskDone } from "@/server/actions/tasks";

/** "Mark done" with an optional note, e.g. when and how a bill was paid. */
export function MarkDoneButton({ taskId, title }: { taskId: string; title: string }) {
  const t = useTranslations("tasks");
  const { notify } = useUpload();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const noteId = `note-${taskId}`;

  const submit = () =>
    startTransition(async () => {
      const result = await markTaskDone(taskId, note);
      if (result.ok) {
        setOpen(false);
        setNote("");
        notify(t("done", { title }));
      } else {
        notify(t("doneFailed"), "danger");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("markDone")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("markDoneTitle")}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor={noteId} className="text-[13px] text-ink-2">
            {t("noteLabel")}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_TASK_NOTE_LENGTH}
            rows={3}
            placeholder={t("notePlaceholder")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
            }}
            className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <DialogFooter className="mt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("markDone")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
