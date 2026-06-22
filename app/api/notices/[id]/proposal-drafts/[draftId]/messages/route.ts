import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getAnalysisReport, getNotice } from "@/lib/repositories/notices";
import { getProposalDraftById, updateProposalDraftWithMessages } from "@/lib/repositories/proposal-drafts";
import { reviseProposalDraft } from "@/lib/services/llm";
import { truncateText } from "@/lib/utils/text";

export const runtime = "nodejs";
export const maxDuration = 90;

type ProposalDraftMessageRouteContext = {
  params: Promise<{
    id: string;
    draftId: string;
  }>;
};

type ProposalDraftMessageRequestBody = {
  message?: unknown;
};

export async function POST(request: NextRequest, context: ProposalDraftMessageRouteContext): Promise<NextResponse> {
  const { id, draftId } = await context.params;
  const noticeId = decodeURIComponent(id);

  try {
    const parsedDraftId = parsePositiveInteger(draftId);

    if (!parsedDraftId) {
      return jsonError("제안서 초안을 찾지 못했습니다.", 404);
    }

    const notice = await getNotice(noticeId);

    if (!notice) {
      return jsonError("공고를 찾지 못했습니다.", 404);
    }

    const draft = await getProposalDraftById(noticeId, parsedDraftId);

    if (!draft) {
      return jsonError("제안서 초안을 찾지 못했습니다.", 404);
    }

    const analysisReport = await getAnalysisReport(noticeId, draft.analysisReportId);

    if (!analysisReport) {
      return jsonError("초안의 기준 분석 파일을 찾지 못했습니다.", 400);
    }

    const body = (await request.json().catch(() => ({}))) as ProposalDraftMessageRequestBody;
    const userMessage = truncateText(String(body.message ?? "").trim(), 4000);

    if (!userMessage) {
      return jsonError("수정 요청을 입력해주세요.", 400);
    }

    const proposal = await reviseProposalDraft({
      notice,
      analysisReport,
      currentDraft: draft.contentMarkdown,
      messages: draft.messages,
      userMessage
    });
    const contentMarkdown = proposal.contentMarkdown.trim();

    if (!contentMarkdown) {
      throw new Error("제안서 초안 수정 결과가 비어 있습니다.");
    }

    const updatedDraft = await updateProposalDraftWithMessages({
      draftId: draft.id,
      contentMarkdown,
      modelProvider: proposal.provider,
      userMessage,
      assistantMessage: proposal.assistantMessage
    });

    revalidatePath(`/notices/${encodeURIComponent(noticeId)}`);

    return NextResponse.json({ draft: updatedDraft });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "제안서 초안 수정에 실패했습니다.", 500);
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
