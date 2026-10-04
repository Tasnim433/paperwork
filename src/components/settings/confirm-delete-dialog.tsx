"use client";

import { useRouter } from "next/navigation";
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
import { confirmationMatches } from "@/lib/settings";
import type { SettingsResult } from "@/server/actions/settings";

type Props = {
  kind: "documents" | "account";
  /** What the user must type to enable the button (a word or the email address). */
  expected: string;
  action: (confirmation: string) => Promise<SettingsResult>;
};

/** Destructive action behind a dialog that requires typing a confirmation. */
export function ConfirmDeleteDialog({ kind, expected, action }: Props) {
  const t = useTranslations(`settings.delete.${kind}`);
  const tCommon = useTranslations("settings.delete");
  const { notify } = useUpload();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = confirmationMatches(typed, expected);
  const inputId = `confirm-${kind}`;

  const run = () =>
    startTransition(async () => {
      const result = await action(typed);
      if (!result.ok) {
        notify(tCommon(result.error === "confirmation" ? "mismatch" : "failed"), "danger");
        return;
      }
      setOpen(false);
      setTyped("");
      notify(t("done"));
      if (kind === "account") {
        router.replace("/sign-in");
        router.refresh();
      } else {
        router.refresh();
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-danger hover:text-danger">
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("warning")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (matches) run();
          }}
        >
          <label htmlFor={inputId} className="text-[13px] text-ink-2">
            {tCommon.rich("typeToConfirm", {
              value: expected,
              code: (chunks) => (
                <span className="font-mono font-medium text-foreground">{chunks}</span>
              ),
            })}
          </label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-9"
          />
          <DialogFooter className="mt-3">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!matches || pending}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
