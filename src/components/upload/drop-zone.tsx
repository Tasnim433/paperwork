"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useUpload } from "./upload-provider";

/** Dashed drop area on the Inbox page, as in the mockup. */
export function DropZone() {
  const t = useTranslations("upload");
  const { openPicker, uploadFiles, uploading } = useUpload();
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!uploading) void uploadFiles(event.dataTransfer.files);
      }}
      className={cn(
        "mb-9 flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-neutral-dot px-6 py-7 text-center transition-colors",
        dragging && "border-brand bg-brand-soft",
      )}
    >
      <p className="text-[15px] font-medium">{dragging ? t("dropActive") : t("dropTitle")}</p>
      <p className="text-muted-foreground">{t("dropHint")}</p>
      <Button variant="outline" size="sm" onClick={openPicker} disabled={uploading}>
        {t("chooseFile")}
      </Button>
    </div>
  );
}
