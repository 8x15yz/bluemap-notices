import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createAnalysisReport, getNotice, listAnalysisReports } from "@/lib/repositories/notices";
import { hasAnalysisReportForFile } from "@/lib/services/analysis-report-status";
import { parseUploadedDocument } from "@/lib/services/document-parser";
import { generateStrategyMemo } from "@/lib/services/llm";
import { truncateText } from "@/lib/utils/text";

export const runtime = "nodejs";
export const maxDuration = 90;

type AnalyzeRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: AnalyzeRouteContext) {
  const { id } = await context.params;
  const noticeId = decodeURIComponent(id);
  const detailUrl = new URL(`/notices/${encodeURIComponent(noticeId)}`, request.url);

  try {
    const notice = await getNotice(noticeId);

    if (!notice) {
      return redirectAfterPost(withQuery(detailUrl, "analysisError", "공고를 찾지 못했습니다."));
    }

    const formData = await request.formData();
    const file = formData.get("document");

    if (!(file instanceof File)) {
      return redirectAfterPost(withQuery(detailUrl, "analysisError", "첨부파일을 선택해주세요."));
    }

    const reports = await listAnalysisReports(noticeId);

    if (hasAnalysisReportForFile(reports, file.name)) {
      return redirectAfterPost(withQuery(detailUrl, "analysis", "existing"));
    }

    const parsedDocument = await parseUploadedDocument(file);
    const strategy = await generateStrategyMemo({
      notice,
      documentMarkdown: parsedDocument.markdown
    });

    await createAnalysisReport({
      noticeId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      documentMarkdown: parsedDocument.markdown,
      strategyMemo: strategy.memo,
      modelProvider: strategy.provider
    });

    revalidatePath(`/notices/${encodeURIComponent(noticeId)}`);
    return redirectAfterPost(withQuery(detailUrl, "analysis", "done"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석에 실패했습니다.";
    return redirectAfterPost(withQuery(detailUrl, "analysisError", truncateText(message, 160)));
  }
}

function redirectAfterPost(url: URL): NextResponse {
  return NextResponse.redirect(url, 303);
}

function withQuery(url: URL, key: string, value: string): URL {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set(key, value);
  return nextUrl;
}
