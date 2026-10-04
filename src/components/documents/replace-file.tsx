"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { UploadResponse } from "@/app/api/documents/route";
import { useUpload } from "@/components/upload/upload-provider";
import { isLocale } from "@/i18n/config";
import { acceptAttribute, checkUpload } from "@/lib/files";
import { formatDate } from "@/lib/format";

/**
 * Hidden file input that uploads a replacement for a document not confirmed yet.
 * Returns `open()` to show the picker and the input element to render.
 */
export function useReplaceFile(documentId: string, options: { onReplaced?: () => void } = {}) {
  const t = useTranslations("upload");
  const tReplace = useTranslations("documents.replace");
  const locale = useLocale();
  const router = useRouter();
  const { notify } = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    const name = file.name;
    const clientError = checkUpload(file);
    if (clientError) {
      notify(t(`errors.${clientError}`, { name }), "danger");
      return;
    }
    setBusy(true);
    notify(t("uploading", { name }));
    const body = new FormData();
    body.append("file", file);
    const result = (await fetch(`/api/documents/${documentId}/replace`, { method: "POST", body })
      .then((response) => response.json())
      .catch(() => ({ ok: false, error: "failed" }))) as
      UploadResponse | { ok: false; error: "notAllowed" };
    setBusy(false);

    if (result.ok) {
      notify(tReplace("done", { name }));
      options.onReplaced?.();
      router.refresh();
      return;
    }
    if (result.error === "notAllowed") notify(tReplace("notAllowed"), "danger");
    else if (result.error === "duplicate")
      notify(
        result.existing && isLocale(locale)
          ? t("errors.duplicate", { name, date: formatDate(result.existing.receivedDate, locale) })
          : t("errors.duplicateNoDate", { name }),
        "danger",
      );
    else notify(t(`errors.${result.error}`, { name }), "danger");
  };

  const element = (
    <input
      ref={input}
      type="file"
      accept={acceptAttribute}
      hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void upload(file);
      }}
    />
  );

  return { open: () => input.current?.click(), element, busy };
}
