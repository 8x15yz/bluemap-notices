import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createAnalysisReport, getNotice, listAnalysisReports } from "@/lib/repositories/notices";
import { findNoticeAttachment, validateG2bDownloadUrl } from "@/lib/services/attachment-download";
import { hasAnalysisReportForFile } from "@/lib/services/analysis-report-status";
import { isSupportedDocumentFileName, parseDocumentBuffer } from "@/lib/services/document-parser";
import { generateStrategyMemo } from "@/lib/services/llm";
import { truncateText } from "@/lib/utils/text";

export const runtime = "nodejs";
export const maxDuration = 90;

type AttachmentAnalyzeRouteContext = {
  params: Promise<{
    id: string;
    sequence: string;
  }>;
};

export async function POST(request: NextRequest, context: AttachmentAnalyzeRouteContext): Promise<NextResponse> {
  const { id, sequence } = await context.params;
  const noticeId = decodeURIComponent(id);
  const detailUrl = new URL(`/notices/${encodeURIComponent(noticeId)}`, request.url);

  try {
    const attachmentSequence = Number(sequence);

    if (!Number.isInteger(attachmentSequence) || attachmentSequence < 0) {
      throw new Error("첨부파일 번호가 올바르지 않습니다.");
    }

    const notice = await getNotice(noticeId);

    if (!notice) {
      throw new Error("공고를 찾지 못했습니다.");
    }

    const attachment = findNoticeAttachment(notice.metadata, attachmentSequence);

    if (!attachment) {
      throw new Error("첨부파일을 찾지 못했습니다.");
    }

    if (!isSupportedDocumentFileName(attachment.name)) {
      throw new Error("PDF, HWPX 또는 HWP 첨부파일만 분석할 수 있습니다.");
    }

    const reports = await listAnalysisReports(noticeId);

    if (hasAnalysisReportForFile(reports, attachment.name)) {
      return redirectAfterPost(withQuery(detailUrl, "analysis", "existing"));
    }

    const downloadUrl = validateG2bDownloadUrl(attachment.url);
    const upstreamResponse = await fetch(downloadUrl, {
      headers: {
        accept: "*/*",
        referer: notice.url,
        "user-agent": request.headers.get("user-agent") || "Mozilla/5.0"
      },
      cache: "no-store",
      redirect: "follow"
    });

    if (!upstreamResponse.ok) {
      throw new Error(`나라장터 첨부파일 다운로드에 실패했습니다. (HTTP ${upstreamResponse.status})`);
    }

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    const parsedDocument = await parseDocumentBuffer(attachment.name, buffer);
    const strategy = await generateStrategyMemo({
      notice,
      documentMarkdown: parsedDocument.markdown
    });

    await createAnalysisReport({
      noticeId,
      fileName: attachment.name,
      fileType: upstreamResponse.headers.get("content-type") || "application/octet-stream",
      documentMarkdown: parsedDocument.markdown,
      strategyMemo: strategy.memo,
      modelProvider: strategy.provider
    });

    revalidatePath(`/notices/${encodeURIComponent(noticeId)}`);
    return redirectAfterPost(withQuery(detailUrl, "analysis", "done"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "첨부파일 분석에 실패했습니다.";
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
