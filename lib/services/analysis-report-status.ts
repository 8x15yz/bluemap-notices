import type { AnalysisReport } from "@/lib/types";

export function hasAnalysisReportForFile(reports: Pick<AnalysisReport, "fileName">[], fileName: string): boolean {
  const normalizedFileName = normalizeAnalysisFileName(fileName);

  return reports.some((report) => normalizeAnalysisFileName(report.fileName) === normalizedFileName);
}

export function normalizeAnalysisFileName(fileName: string): string {
  return fileName.trim().toLocaleLowerCase("ko-KR");
}
