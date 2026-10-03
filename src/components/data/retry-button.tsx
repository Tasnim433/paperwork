"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { retryDocument } from "@/server/actions/documents";

function Submit() {
  const t = useTranslations("inboxStatus");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {t("retry")}
    </Button>
  );
}

export function RetryButton({ documentId }: { documentId: string }) {
  return (
    <form action={retryDocument.bind(null, documentId)}>
      <Submit />
    </form>
  );
}
