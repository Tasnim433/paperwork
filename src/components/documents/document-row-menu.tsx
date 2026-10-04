"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeletionKind } from "@/lib/deletion";

import { DeleteDocumentsDialog } from "./delete-documents-dialog";
import { useReplaceFile } from "./replace-file";

/** Per-row actions: replace the file (Inbox only) and discard / delete. */
export function DocumentRowMenu({
  documentId,
  label,
  kind,
  canReplace,
}: {
  documentId: string;
  /** Accessible name of the row, e.g. the sender. */
  label: string;
  kind: DeletionKind;
  canReplace: boolean;
}) {
  const t = useTranslations("documents");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const replace = useReplaceFile(documentId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("menu", { name: label })}
            disabled={replace.busy}
          >
            <MoreHorizontal strokeWidth={1.7} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canReplace && (
            <DropdownMenuItem onSelect={replace.open}>{t("replace.action")}</DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-danger focus:text-danger"
            onSelect={() => setDeleting(true)}
          >
            {t(`delete.${kind}.action`)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {replace.element}
      <DeleteDocumentsDialog
        ids={[documentId]}
        kind={kind}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
