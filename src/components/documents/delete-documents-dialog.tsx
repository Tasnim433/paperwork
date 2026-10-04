"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpload } from "@/components/upload/upload-provider";
import type { DeletionKind, DeletionSummary } from "@/lib/deletion";
import {
  deleteRecordDocuments,
  deletionPreview,
  discardDocuments,
} from "@/server/actions/documents";

const rows: Exclude<keyof DeletionSummary, "documents">[] = [
  "files",
  "fields",
  "pages",
  "openTasks",
  "reminders",
  "completedTasks",
  "workEntries",
];

/**
 * Confirms discarding (Inbox, Review) or deleting (Records) documents. Before
 * confirming, it shows exactly what will be removed, as counted on the server.
 */
export function DeleteDocumentsDialog({
  ids,
  kind,
  open,
  onOpenChange,
  onDeleted,
}: {
  ids: string[];
  kind: DeletionKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("documents.delete");
  const { notify } = useUpload();
  const [pending, startTransition] = useTransition();
  const key = ids.join(",");
  // The preview belongs to one request; a stale one (other ids, closed dialog) is ignored.
  const requestKey = open ? `${kind}:${key}` : null;
  const [preview, setPreview] = useState<{
    key: string;
    summary: DeletionSummary | null;
  } | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    deletionPreview(key.split(","), kind)
      .then((result) => {
        if (!cancelled) setPreview({ key: requestKey, summary: result.ok ? result.summary : null });
      })
      .catch(() => {
        if (!cancelled) setPreview({ key: requestKey, summary: null });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, key, kind]);

  const current = preview?.key === requestKey ? preview : null;
  const summary = current?.summary ?? null;
  const failed = current !== null && current.summary === null;

  const confirm = () =>
    startTransition(async () => {
      const action = kind === "discard" ? discardDocuments : deleteRecordDocuments;
      const result = await action(ids);
      if (!result.ok) {
        notify(t("failed"), "danger");
        return;
      }
      onOpenChange(false);
      notify(t(`${kind}.done`, { count: result.deleted }));
      onDeleted?.();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t(`${kind}.title`, { count: ids.length })}</DialogTitle>
          <DialogDescription>{t(`${kind}.warning`)}</DialogDescription>
        </DialogHeader>
        <div className="text-[13px]">
          {failed ? (
            <p className="text-danger">{t("previewFailed")}</p>
          ) : !summary ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : (
            <>
              <p className="mb-2 text-ink-2">{t("removes", { count: summary.documents })}</p>
              <ul className="flex flex-col">
                {rows.map((row) => (
                  <li
                    key={row}
                    className="flex justify-between gap-3 border-b border-line-2 py-1.5 last:border-b-0"
                  >
                    <span className={summary[row] === 0 ? "text-muted-foreground" : undefined}>
                      {t(`items.${row}`)}
                    </span>
                    <span className="tabular-nums">{summary[row]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">{t("auditNote")}</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!summary || pending}
            onClick={confirm}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {t(`${kind}.confirm`, { count: ids.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
