"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BoundingBox } from "@/lib/text/types";
import { cn } from "@/lib/utils";

export type FieldBox = { key: string; page: number; box: BoundingBox };

type Props = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  boxes: FieldBox[];
  activeKey: string | null;
  /** Field labels for accessible names of the highlight buttons. */
  labels: Record<string, string>;
  onBoxHover: (key: string | null) => void;
  onBoxClick: (key: string) => void;
};

const ZOOM_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
/** Pixel width pages are rendered at; enough for 140 % zoom on high-density screens. */
const RENDER_WIDTH = 1600;
/** Extra space around a highlighted value, relative to the page. */
const PAD = 0.004;

export function DocumentViewer(props: Props) {
  const t = useTranslations("review.viewer");
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const [pageCount, setPageCount] = useState(1);
  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <section
      aria-label={t("label")}
      className="overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--muted)_70%,var(--background))] desktop:sticky desktop:top-[80px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2 text-[12.5px] text-muted-foreground">
        <span className="min-w-0 truncate font-mono text-xs">{props.fileName}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("zoomOut")}
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          >
            <Minus strokeWidth={1.7} />
          </Button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("zoomIn")}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          >
            <Plus strokeWidth={1.7} />
          </Button>
          <span className="ml-2.5 tabular-nums">{t("page", { page: 1, pages: pageCount })}</span>
        </div>
      </div>
      <div className="max-h-none overflow-auto p-4 desktop:max-h-[calc(100vh-170px)] desktop:p-7">
        <div
          className="mx-auto flex flex-col gap-4"
          style={{ width: `${zoom * 100}%`, maxWidth: 560 * zoom }}
        >
          {props.mimeType === "application/pdf" ? (
            <PdfPages {...props} onPageCount={setPageCount} />
          ) : (
            <Page number={1} {...props}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private original, served by our API */}
              <img
                src={props.fileUrl}
                alt={props.fileName}
                className="block w-full"
                draggable={false}
              />
            </Page>
          )}
        </div>
      </div>
    </section>
  );
}

function Page({
  number,
  boxes,
  activeKey,
  labels,
  onBoxHover,
  onBoxClick,
  children,
  aspect,
}: Props & { number: number; children: React.ReactNode; aspect?: number }) {
  const t = useTranslations("review.viewer");
  const activeRef = useRef<HTMLButtonElement>(null);

  // Bring the highlighted value into view when a field gets focus.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeKey]);

  return (
    <div
      className="relative bg-white text-[#1b1c1f] ring-1 ring-black/5"
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {children}
      {boxes
        .filter((box) => box.page === number)
        .map(({ key, box }) => {
          const active = key === activeKey;
          return (
            <button
              key={key}
              ref={active ? activeRef : undefined}
              type="button"
              tabIndex={-1}
              aria-label={t("highlight", { field: labels[key] ?? key })}
              onMouseEnter={() => onBoxHover(key)}
              onMouseLeave={() => onBoxHover(null)}
              onClick={() => onBoxClick(key)}
              className={cn(
                "absolute cursor-pointer rounded-[2px] transition-[background-color,box-shadow] duration-100",
                active
                  ? "bg-[rgba(13,92,80,0.14)] outline-[1.5px] outline-[#0d5c50] outline-solid"
                  : "hover:bg-[rgba(13,92,80,0.08)]",
              )}
              style={{
                left: `${(box.x - PAD) * 100}%`,
                top: `${(box.y - PAD) * 100}%`,
                width: `${(box.width + PAD * 2) * 100}%`,
                height: `${(box.height + PAD * 2) * 100}%`,
              }}
            />
          );
        })}
    </div>
  );
}

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | undefined;

function loadPdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

function PdfPages(props: Props & { onPageCount: (count: number) => void }) {
  const t = useTranslations("review.viewer");
  const [pages, setPages] = useState<{ number: number; aspect: number; url: string }[] | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const { fileUrl, onPageCount } = props;

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<PdfJs["getDocument"]> | undefined;

    (async () => {
      const pdfjs = await loadPdfjs();
      task = pdfjs.getDocument({ url: fileUrl, withCredentials: true });
      const pdf = await task.promise;
      const rendered: { number: number; aspect: number; url: string }[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        rendered.push({
          number,
          aspect: base.width / base.height,
          url: canvas.toDataURL("image/png"),
        });
        if (cancelled) return;
      }
      if (!cancelled) {
        setPages(rendered);
        onPageCount(pdf.numPages);
      }
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [fileUrl, onPageCount]);

  if (failed) return <p className="py-16 text-center text-muted-foreground">{t("error")}</p>;
  if (!pages) return <p className="py-16 text-center text-muted-foreground">{t("loading")}</p>;

  return pages.map((page) => (
    <Page key={page.number} number={page.number} aspect={page.aspect} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered PDF page */}
      <img src={page.url} alt="" className="block h-full w-full" draggable={false} />
    </Page>
  ));
}
