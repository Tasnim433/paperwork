"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useUpload } from "./upload-provider";

/** Top bar button: opens the file picker. */
export function UploadButton() {
  const t = useTranslations("topbar");
  const { openPicker, uploading } = useUpload();
  return (
    <Button size="sm" onClick={openPicker} disabled={uploading}>
      {t("upload")}
    </Button>
  );
}
