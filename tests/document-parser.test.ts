import { describe, expect, it } from "vitest";
import { isSupportedDocumentFileName } from "@/lib/services/document-parser";

describe("document parser support", () => {
  it("allows PDF, HWPX, and HWP document attachments", () => {
    expect(isSupportedDocumentFileName("공고문.PDF")).toBe(true);
    expect(isSupportedDocumentFileName("제안요청서.hwpx")).toBe(true);
    expect(isSupportedDocumentFileName("과업지시서.HWP")).toBe(true);
  });

  it("blocks unsupported attachment formats", () => {
    expect(isSupportedDocumentFileName("산출내역서.xlsx")).toBe(false);
    expect(isSupportedDocumentFileName("첨부파일")).toBe(false);
  });
});
