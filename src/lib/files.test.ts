import { describe, expect, it } from "vitest";

import { checkUpload, detectFileType, MAX_UPLOAD_BYTES } from "./files";

describe("detectFileType", () => {
  it("recognizes PDF, JPEG and PNG by their first bytes", () => {
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7\n"))).toEqual({
      mimeType: "application/pdf",
      extension: "pdf",
    });
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(
      detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension,
    ).toBe("png");
  });

  it("rejects other content regardless of name", () => {
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectFileType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip/docx
    expect(detectFileType(new Uint8Array([]))).toBeNull();
  });
});

describe("checkUpload", () => {
  const file = (size: number, type: string, name: string) => ({ size, type, name });

  it("accepts PDF, JPG and PNG up to 20 MB", () => {
    expect(checkUpload(file(1000, "application/pdf", "brief.pdf"))).toBeNull();
    expect(checkUpload(file(MAX_UPLOAD_BYTES, "image/jpeg", "foto.jpg"))).toBeNull();
    expect(checkUpload(file(1000, "", "scan.PNG"))).toBeNull();
  });

  it("rejects empty, too large and unsupported files", () => {
    expect(checkUpload(file(0, "application/pdf", "a.pdf"))).toBe("empty");
    expect(checkUpload(file(MAX_UPLOAD_BYTES + 1, "application/pdf", "a.pdf"))).toBe("tooLarge");
    expect(checkUpload(file(1000, "application/msword", "a.doc"))).toBe("unsupportedType");
  });
});
