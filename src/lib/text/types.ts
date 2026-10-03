/** Rectangle relative to the page size: all values between 0 and 1, origin top-left. */
export type BoundingBox = { x: number; y: number; width: number; height: number };

/** One recognized word with its position on the page. */
export type PageWord = { text: string } & BoundingBox;

export type PageText = {
  pageNumber: number;
  /** Page size in the source's units (PDF points or image pixels). */
  width: number;
  height: number;
  source: "text_layer" | "ocr";
  words: PageWord[];
};
