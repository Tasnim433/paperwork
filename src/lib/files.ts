/** Upload rules shared by the browser and the server. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const acceptedFileTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type AcceptedMimeType = keyof typeof acceptedFileTypes;
export type FileExtension = (typeof acceptedFileTypes)[AcceptedMimeType];

/** Value for the `accept` attribute of file inputs. */
export const acceptAttribute = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type UploadError = "tooLarge" | "empty" | "unsupportedType";

/** Quick check on the browser side, based on the declared type and size. */
export function checkUpload(file: {
  size: number;
  type: string;
  name: string;
}): UploadError | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "tooLarge";
  const byType = file.type in acceptedFileTypes;
  const byName = /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!byType && !byName) return "unsupportedType";
  return null;
}

/**
 * Detects the real file type from its first bytes. The server relies on this,
 * never on the file name or declared type.
 */
export function detectFileType(
  bytes: Uint8Array,
): { mimeType: AcceptedMimeType; extension: FileExtension } | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d))
    return { mimeType: "application/pdf", extension: "pdf" }; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return { mimeType: "image/jpeg", extension: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { mimeType: "image/png", extension: "png" };
  return null;
}
