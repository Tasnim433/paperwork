"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { DeletionKind } from "@/lib/deletion";

import { DeleteDocumentsDialog } from "./delete-documents-dialog";
import { useReplaceFile } from "./replace-file";

/** "Discard" (Review) or "Delete document" (document page) as a button with its dialog. */
export function DeleteDocumentButton({
  documentId,
  kind,
  afterDelete,
}: {
  documentId: string;
  kind: DeletionKind;
  /** Where to go once the document is gone. */
  afterDelete: string;
}) {
  const t = useTranslations("documents.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="text-danger hover:text-danger"
        onClick={() => setOpen(true)}
      >
        {t(`${kind}.action`)}
      </Button>
      <DeleteDocumentsDialog
        ids={[documentId]}
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => {
          router.push(afterDelete);
          router.refresh();
        }}
      />
    </>
  );
}

/** "Replace file" for a document that is not confirmed yet. */
export function ReplaceFileButton({
  documentId,
  afterReplace,
}: {
  documentId: string;
  afterReplace: string;
}) {
  const t = useTranslations("documents.replace");
  const router = useRouter();
  const replace = useReplaceFile(documentId, { onReplaced: () => router.push(afterReplace) });
  return (
    <>
      <Button variant="ghost" disabled={replace.busy} onClick={replace.open}>
        {t("action")}
      </Button>
      {replace.element}
    </>
  );
}
