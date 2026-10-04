"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpload } from "@/components/upload/upload-provider";
import { parseReminderOffsets } from "@/lib/settings";
import { updateReminderOffsets } from "@/server/actions/settings";

/** "Reminder schedule" row: shows the offsets, Edit turns it into an input. */
export function ReminderOffsetsForm({ offsets }: { offsets: number[] }) {
  const t = useTranslations("settings.reminders");
  const { notify } = useUpload();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(offsets.join(", "));
  const [pending, startTransition] = useTransition();
  const parsed = parseReminderOffsets(value);

  const save = () =>
    startTransition(async () => {
      const result = await updateReminderOffsets(value);
      if (result.ok) {
        setEditing(false);
        notify(t("saved"));
      } else {
        notify(t("invalid"), "danger");
      }
    });

  const description = t("scheduleValue", { days: offsets.join(", "), count: offsets.length });

  if (!editing) {
    return (
      <>
        <span>{description}</span>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
      </>
    );
  }

  return (
    <>
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed) save();
        }}
      >
        <label htmlFor="reminder-offsets" className="sr-only">
          {t("schedule")}
        </label>
        <Input
          id="reminder-offsets"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={!parsed}
          aria-describedby="reminder-offsets-hint"
          className="h-9 max-w-[220px]"
          autoFocus
        />
        <p
          id="reminder-offsets-hint"
          className={parsed ? "text-xs text-muted-foreground" : "text-xs text-danger"}
        >
          {parsed ? t("hint") : t("invalid")}
        </p>
      </form>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setValue(offsets.join(", "));
            setEditing(false);
          }}
        >
          {t("cancel")}
        </Button>
        <Button size="sm" disabled={!parsed || pending} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </>
  );
}
