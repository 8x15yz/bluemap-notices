import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getAnalysisReport, getNotice } from "@/lib/repositories/notices";
import {
  createProposalDraftWithMessage,
  getProposalDraftForAnalysisReport
} from "@/lib/repositories/proposal-drafts";
import { generateProposalDraft } from "@/lib/services/llm";
import { truncateText } from "@/lib/utils/text";

export const runtime = "nodejs";
export const maxDuration = 90;

type ProposalDraftRouteContext = {
  params: Promise<{ id: string }>;
};

type ProposalDraftRequestBody = {
  analysisReportId?: unknown;
};

export async function POST(request: NextRequest, context: ProposalDraftRouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const noticeId = decodeURIComponent(id);

  try {
    const notice = await getNotice(noticeId);

    if (!notice) {
      return jsonError("공고를 찾지 못했습니다.", 404);
    }

    const body = (await request.json().catch(() => ({}))) as ProposalDraftRequestBody;
    const analysisReportId = parsePositiveInteger(body.analysisReportId);

    if (!analysisReportId) {
      return jsonError("분석 완료된 첨부파일을 선택해주세요.", 400);
    }

    const analysisReport = await getAnalysisReport(noticeId, analysisReportId);

    if (!analysisReport) {
      return jsonError("분석 완료된 첨부파일을 선택해주세요.", 400);
    }

    const existingDraft = await getProposalDraftForAnalysisReport(noticeId, analysisReportId);

    if (existingDraft) {
      return NextResponse.json({ draft: existingDraft, existing: true });
    }

    const proposal = await generateProposalDraft({
      notice,
      analysisReport
    });
    const contentMarkdown = proposal.contentMarkdown.trim();

    if (!contentMarkdown) {
      throw new Error("제안서 초안 생성 결과가 비어 있습니다.");
    }

    const draft = await createProposalDraftWithMessage({
      noticeId,
      analysisReportId,
      contentMarkdown,
      modelProvider: proposal.provider,
      assistantMessage: proposal.assistantMessage
    });

    revalidatePath(`/notices/${encodeURIComponent(noticeId)}`);

    return NextResponse.json({ draft, existing: false });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "제안서 초안 생성에 실패했습니다.", 500);
  }
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      error: truncateText(message, 180)
    },
    { status }
  );
}
