import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as createProposalDraft } from "@/app/api/notices/[id]/proposal-drafts/route";
import { POST as reviseProposalDraftMessage } from "@/app/api/notices/[id]/proposal-drafts/[draftId]/messages/route";
import { getAnalysisReport, getNotice } from "@/lib/repositories/notices";
import {
  createProposalDraftWithMessage,
  getProposalDraftById,
  getProposalDraftForAnalysisReport,
  updateProposalDraftWithMessages
} from "@/lib/repositories/proposal-drafts";
import { generateProposalDraft, reviseProposalDraft } from "@/lib/services/llm";
import type { AnalysisReport, NoticeRecord, ProposalDraft } from "@/lib/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/repositories/notices", () => ({
  getAnalysisReport: vi.fn(),
  getNotice: vi.fn()
}));

vi.mock("@/lib/repositories/proposal-drafts", () => ({
  createProposalDraftWithMessage: vi.fn(),
  getProposalDraftById: vi.fn(),
  getProposalDraftForAnalysisReport: vi.fn(),
  updateProposalDraftWithMessages: vi.fn()
}));

vi.mock("@/lib/services/llm", () => ({
  generateProposalDraft: vi.fn(),
  reviseProposalDraft: vi.fn()
}));

const createProposalDraftWithMessageMock = vi.mocked(createProposalDraftWithMessage);
const generateProposalDraftMock = vi.mocked(generateProposalDraft);
const getAnalysisReportMock = vi.mocked(getAnalysisReport);
const getNoticeMock = vi.mocked(getNotice);
const getProposalDraftByIdMock = vi.mocked(getProposalDraftById);
const getProposalDraftForAnalysisReportMock = vi.mocked(getProposalDraftForAnalysisReport);
const revalidatePathMock = vi.mocked(revalidatePath);
const reviseProposalDraftMock = vi.mocked(reviseProposalDraft);
const updateProposalDraftWithMessagesMock = vi.mocked(updateProposalDraftWithMessages);

describe("proposal draft routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a proposal draft from a selected analysis report", async () => {
    const notice = createNotice();
    const report = createReport();
    const draft = createDraft();
    getNoticeMock.mockResolvedValueOnce(notice);
    getAnalysisReportMock.mockResolvedValueOnce(report);
    getProposalDraftForAnalysisReportMock.mockResolvedValueOnce(null);
    generateProposalDraftMock.mockResolvedValueOnce({
      provider: "mock",
      contentMarkdown: "# 제안서 초안",
      assistantMessage: "제안서 초안을 작성했습니다."
    });
    createProposalDraftWithMessageMock.mockResolvedValueOnce(draft);

    const response = await createProposalDraft(createJsonRequest("/api/notices/g2b_notice/proposal-drafts", { analysisReportId: 1 }), {
      params: Promise.resolve({ id: notice.id })
    });
    const payload = (await response.json()) as { draft: ProposalDraft };

    expect(response.status).toBe(200);
    expect(payload.draft.id).toBe(draft.id);
    expect(generateProposalDraftMock).toHaveBeenCalledWith({ notice, analysisReport: report });
    expect(createProposalDraftWithMessageMock).toHaveBeenCalledWith({
      noticeId: notice.id,
      analysisReportId: report.id,
      contentMarkdown: "# 제안서 초안",
      modelProvider: "mock",
      assistantMessage: "제안서 초안을 작성했습니다."
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/notices/${encodeURIComponent(notice.id)}`);
  });

  it("returns a clear error when the selected analysis report does not exist", async () => {
    getNoticeMock.mockResolvedValueOnce(createNotice());
    getAnalysisReportMock.mockResolvedValueOnce(null);

    const response = await createProposalDraft(createJsonRequest("/api/notices/g2b_notice/proposal-drafts", { analysisReportId: 99 }), {
      params: Promise.resolve({ id: "g2b_notice" })
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("분석 완료된 첨부파일을 선택해주세요.");
    expect(generateProposalDraftMock).not.toHaveBeenCalled();
    expect(createProposalDraftWithMessageMock).not.toHaveBeenCalled();
  });

  it("revises a saved proposal draft and stores the conversation", async () => {
    const notice = createNotice();
    const report = createReport();
    const draft = createDraft();
    const updatedDraft = createDraft({
      contentMarkdown: "# 수정된 제안서 초안",
      messages: [
        ...draft.messages,
        {
          id: 2,
          draftId: draft.id,
          role: "user",
          content: "차별화 포인트 보강",
          createdAt: new Date().toISOString()
        },
        {
          id: 3,
          draftId: draft.id,
          role: "assistant",
          content: "요청을 반영해 제안서 초안을 갱신했습니다.",
          createdAt: new Date().toISOString()
        }
      ]
    });
    getNoticeMock.mockResolvedValueOnce(notice);
    getProposalDraftByIdMock.mockResolvedValueOnce(draft);
    getAnalysisReportMock.mockResolvedValueOnce(report);
    reviseProposalDraftMock.mockResolvedValueOnce({
      provider: "mock",
      contentMarkdown: "# 수정된 제안서 초안",
      assistantMessage: "요청을 반영해 제안서 초안을 갱신했습니다."
    });
    updateProposalDraftWithMessagesMock.mockResolvedValueOnce(updatedDraft);

    const response = await reviseProposalDraftMessage(
      createJsonRequest("/api/notices/g2b_notice/proposal-drafts/1/messages", { message: "차별화 포인트 보강" }),
      {
        params: Promise.resolve({ id: notice.id, draftId: "1" })
      }
    );
    const payload = (await response.json()) as { draft: ProposalDraft };

    expect(response.status).toBe(200);
    expect(payload.draft.contentMarkdown).toBe("# 수정된 제안서 초안");
    expect(reviseProposalDraftMock).toHaveBeenCalledWith({
      notice,
      analysisReport: report,
      currentDraft: draft.contentMarkdown,
      messages: draft.messages,
      userMessage: "차별화 포인트 보강"
    });
    expect(updateProposalDraftWithMessagesMock).toHaveBeenCalledWith({
      draftId: draft.id,
      contentMarkdown: "# 수정된 제안서 초안",
      modelProvider: "mock",
      userMessage: "차별화 포인트 보강",
      assistantMessage: "요청을 반영해 제안서 초안을 갱신했습니다."
    });
  });
});

function createJsonRequest(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function createNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: "g2b_notice",
    sourceId: "g2b",
    externalId: "notice",
    title: "인체 의료영상데이터 DB 구축 및 움직임 3D 시각화",
    url: "https://www.g2b.go.kr",
    organization: "한국과학기술정보연구원",
    deadlineAt: "2026-06-26T01:00:00.000Z",
    budgetAmount: 100000000,
    category: "bid",
    rawKeywordsText: "정보시스템",
    matchedKeywords: ["정보시스템"],
    score: 12,
    scoreReason: "정보시스템 키워드가 공고 내용과 맞습니다.",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slackNotified: false,
    ...overrides
  };
}

function createReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: 1,
    noticeId: "g2b_notice",
    fileName: "제안요청서.hwpx",
    fileType: "application/hwpx",
    documentMarkdown: "# 제안요청서",
    strategyMemo: "공고 분석",
    modelProvider: "mock",
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

function createDraft(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: 1,
    noticeId: "g2b_notice",
    analysisReportId: 1,
    contentMarkdown: "# 제안서 초안",
    modelProvider: "mock",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: 1,
        draftId: 1,
        role: "assistant",
        content: "제안서 초안을 작성했습니다.",
        createdAt: new Date().toISOString()
      }
    ],
    ...overrides
  };
}
