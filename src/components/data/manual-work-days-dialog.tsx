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
import { Input } from "@/components/ui/input";
import { useUpload } from "@/components/upload/upload-provider";
import { validateManualEntry } from "@/lib/work-days";
import { addManualWorkEntry } from "@/server/actions/work-days";

/** "Enter days manually" for a payslip that does not state its work days. */
export function ManualWorkDaysDialog({
  documentId,
  defaultMonth,
}: {
  documentId: string;
  /** "YYYY-MM" from the payslip period, if known. */
  defaultMonth: string | null;
}) {
  const t = useTranslations("workDays.manual");
  const { notify } = useUpload();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth ?? "");
  const [full, setFull] = useState("");
  const [half, setHalf] = useState("");
  const [pending, startTransition] = useTransition();

  const toCount = (value: string) => (value.trim() === "" ? 0 : Number(value));
  const errors = validateManualEntry({ month, fullDays: toCount(full), halfDays: toCount(half) });
  const complete = full.trim() !== "" || half.trim() !== "";

  const save = () =>
    startTransition(async () => {
      const result = await addManualWorkEntry({
        documentId,
        month,
        fullDays: toCount(full),
        halfDays: toCount(half),
      });
      if (result.ok) {
        setOpen(false);
        notify(t("saved"));
      } else {
        notify(t(`errors.${result.error}`), "danger");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (errors.length === 0 && complete) save();
          }}
        >
          <label htmlFor={`month-${documentId}`} className="text-[13px] text-ink-2">
            {t("month")}
          </label>
          <Input
            id={`month-${documentId}`}
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 w-[170px]"
            required
          />
          <label htmlFor={`full-${documentId}`} className="text-[13px] text-ink-2">
            {t("fullDays")}
          </label>
          <Input
            id={`full-${documentId}`}
            inputMode="numeric"
            value={full}
            onChange={(event) => setFull(event.target.value)}
            className="h-9 w-[90px] text-right tabular-nums"
          />
          <label htmlFor={`half-${documentId}`} className="text-[13px] text-ink-2">
            {t("halfDays")}
          </label>
          <Input
            id={`half-${documentId}`}
            inputMode="numeric"
            value={half}
            onChange={(event) => setHalf(event.target.value)}
            className="h-9 w-[90px] text-right tabular-nums"
          />
          {complete && errors.length > 0 && (
            <p role="alert" className="col-span-2 text-xs text-danger">
              {t(`errors.${errors[0]}`)}
            </p>
          )}
          <p className="col-span-2 text-xs text-muted-foreground">{t("hint")}</p>
          <DialogFooter className="col-span-2 mt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !complete || errors.length > 0}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
