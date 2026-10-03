"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import type { UploadResponse } from "@/app/api/documents/route";
import { isLocale } from "@/i18n/config";
import { acceptAttribute, checkUpload } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type UploadContextValue = {
  openPicker: () => void;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  uploading: boolean;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used inside UploadProvider");
  return context;
}

type Toast = { id: number; text: string; tone: "default" | "danger" };

/** Owns the hidden file input, the upload requests and the status toast. */
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((text: string, tone: Toast["tone"] = "default") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast || uploading) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "danger" ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [toast, uploading]);

  const uploadOne = useCallback(
    async (file: File): Promise<boolean> => {
      const name = file.name;
      const clientError = checkUpload(file);
      if (clientError) {
        show(t(`errors.${clientError}`, { name }), "danger");
        return false;
      }

      show(t("uploading", { name }));
      const body = new FormData();
      body.append("file", file);
      const result: UploadResponse = await fetch("/api/documents", { method: "POST", body })
        .then((response) => response.json() as Promise<UploadResponse>)
        .catch(() => ({ ok: false, error: "failed" }) as const);

      if (result.ok) {
        show(t("uploaded", { name }));
        return true;
      }
      if (result.error === "duplicate") {
        show(
          result.existing && isLocale(locale)
            ? t("errors.duplicate", {
                name,
                date: formatDate(result.existing.receivedDate, locale),
              })
            : t("errors.duplicateNoDate", { name }),
          "danger",
        );
      } else {
        show(t(`errors.${result.error}`, { name }), "danger");
      }
      return false;
    },
    [locale, show, t],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      let uploaded = 0;
      for (const file of list) {
        if (await uploadOne(file)) uploaded++;
      }
      setUploading(false);
      if (uploaded > 0) {
        if (pathname !== "/inbox") router.push("/inbox");
        router.refresh();
      }
    },
    [pathname, router, uploadOne],
  );

  const openPicker = useCallback(() => input.current?.click(), []);

  return (
    <UploadContext.Provider value={{ openPicker, uploadFiles, uploading }}>
      {children}
      <input
        ref={input}
        type="file"
        accept={acceptAttribute}
        multiple
        hidden
        onChange={(event) => {
          const files = event.currentTarget.files;
          if (files) void uploadFiles(files);
          event.currentTarget.value = "";
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          toast?.tone === "danger" ? "bg-danger text-white" : "bg-foreground text-background",
        )}
      >
        {toast?.text}
      </div>
    </UploadContext.Provider>
  );
}
