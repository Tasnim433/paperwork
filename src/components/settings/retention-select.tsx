"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useUpload } from "@/components/upload/upload-provider";
import { RETENTION_OPTIONS } from "@/lib/deletion";
import { updateHistoryRetention } from "@/server/actions/settings";

/** How long the history log is kept; enforced by a daily job. */
export function RetentionSelect({ months }: { months: number }) {
  const t = useTranslations("settings.history.retention");
  const { notify } = useUpload();
  const [value, setValue] = useState(months);
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={t("label")}
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = Number(event.target.value);
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await updateHistoryRetention(next);
          if (result.ok) notify(t("saved"));
          else {
            setValue(previous);
            notify(t("failed"), "danger");
          }
        });
      }}
      className="h-8 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {RETENTION_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option === 0 ? t("forever") : t("months", { count: option })}
        </option>
      ))}
    </select>
  );
}
