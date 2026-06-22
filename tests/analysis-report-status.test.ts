import { describe, expect, it } from "vitest";
import { hasAnalysisReportForFile, normalizeAnalysisFileName } from "@/lib/services/analysis-report-status";

describe("analysis report status", () => {
  it("normalizes file names for duplicate checks", () => {
    expect(normalizeAnalysisFileName(" 입찰공고문.PDF ")).toBe("입찰공고문.pdf");
  });

  it("detects an existing report by file name", () => {
    expect(hasAnalysisReportForFile([{ fileName: "입찰공고문.pdf" }], " 입찰공고문.PDF ")).toBe(true);
    expect(hasAnalysisReportForFile([{ fileName: "입찰공고문.pdf" }], "제안요청서.hwpx")).toBe(false);
  });
});
