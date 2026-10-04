import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { createWorker, type Worker } from "tesseract.js";

import { splitRunIntoWords } from "@/lib/text/pdf-words";
import type { PageText, PageWord } from "@/lib/text/types";

import { env } from "../env";

/** Below this many words in the whole text layer, a PDF is treated as scanned and OCR'd. */
const MIN_TEXT_LAYER_WORDS = 5;
/** Render scale for OCR of scanned PDFs (1 = 72 dpi). 2.5 is about 180 dpi. */
const OCR_RENDER_SCALE = 2.5;
const MAX_PAGES = 20;

export class UnreadableDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreadableDocumentError";
  }
}

/** Extracts words with positions from a PDF or image. */
export async function extractText(bytes: Uint8Array, mimeType: string): Promise<PageText[]> {
  if (mimeType === "application/pdf") {
    const pages = await extractPdf(bytes);
    if (pages.length === 0) throw new UnreadableDocumentError("The PDF has no pages.");
    return pages;
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return [await ocrImage(bytes, 1)];
  }
  throw new UnreadableDocumentError(`Unsupported file type: ${mimeType}`);
}

async function loadPdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

/**
 * Directory with the PDF standard fonts shipped by pdfjs-dist, used when rendering
 * scanned PDFs. Resolved from the project root (bundlers rewrite require.resolve).
 */
function standardFontDataUrl(): string | undefined {
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
  if (!existsSync(dir)) return undefined;
  // pdfjs requires forward slashes and a trailing slash, also on Windows.
  return dir.split(path.sep).join("/") + "/";
}

async function extractPdf(bytes: Uint8Array): Promise<PageText[]> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    // pdfjs takes ownership of the buffer, so pass a copy.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: standardFontDataUrl(),
  });
  const doc = await task.promise;

  try {
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const pages: PageText[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const words: PageWord[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        // Into viewport space: top-left origin, y pointing down.
        const tx = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        words.push(
          ...splitRunIntoWords(
            {
              text: item.str,
              x: tx[4],
              y: tx[5] - fontHeight * 0.85,
              width: item.width,
              height: fontHeight,
            },
            viewport.width,
            viewport.height,
          ),
        );
      }
      pages.push({
        pageNumber: n,
        width: viewport.width,
        height: viewport.height,
        source: "text_layer",
        words,
      });
    }

    const textLayerWords = pages.reduce((sum, page) => sum + page.words.length, 0);
    if (textLayerWords >= MIN_TEXT_LAYER_WORDS) return pages;

    // Scanned PDF: render each page and OCR it.
    return await ocrPdfPages(doc, pageCount);
  } finally {
    await task.destroy();
  }
}

type PdfDocument = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>["promise"]
>;

async function ocrPdfPages(doc: PdfDocument, pageCount: number): Promise<PageText[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pages: PageText[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    pages.push(await ocrImage(canvas.toBuffer("image/png"), n));
  }
  return pages;
}

let workerPromise: Promise<Worker> | undefined;

/** One shared OCR worker for German and English; language data is cached on disk. */
async function ocrWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const cachePath = path.resolve(env.TESSERACT_CACHE_DIR);
    await mkdir(cachePath, { recursive: true });
    return createWorker(["deu", "eng"], 1, { cachePath });
  })().catch((error) => {
    workerPromise = undefined;
    throw error;
  });
  return workerPromise;
}

/** Stops the shared OCR worker (tests and scripts; the server keeps it running). */
export async function terminateOcr() {
  const pending = workerPromise;
  workerPromise = undefined;
  if (pending) await (await pending).terminate();
}

async function ocrImage(image: Uint8Array, pageNumber: number): Promise<PageText> {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(Buffer.from(image), {}, { blocks: true });

  const lines = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((p) => p.lines));
  const width = Math.max(1, ...lines.map((line) => line.bbox.x1));
  const height = Math.max(1, ...lines.map((line) => line.bbox.y1));
  const size = await imageSize(image).catch(() => ({ width, height }));

  const words: PageWord[] = lines.flatMap((line) =>
    line.words
      .filter((word) => word.text.trim() && word.confidence > 20)
      .map((word) => ({
        text: word.text.trim(),
        x: word.bbox.x0 / size.width,
        y: word.bbox.y0 / size.height,
        width: (word.bbox.x1 - word.bbox.x0) / size.width,
        height: (word.bbox.y1 - word.bbox.y0) / size.height,
      })),
  );

  return { pageNumber, width: size.width, height: size.height, source: "ocr", words };
}

async function imageSize(image: Uint8Array): Promise<{ width: number; height: number }> {
  const { loadImage } = await import("@napi-rs/canvas");
  const loaded = await loadImage(Buffer.from(image));
  return { width: loaded.width, height: loaded.height };
}
