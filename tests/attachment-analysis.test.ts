import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/notices/[id]/attachments/[sequence]/analyze/route";
import { createAnalysisReport, getNotice, listAnalysisReports } from "@/lib/repositories/notices";
import { isSupportedDocumentFileName, parseDocumentBuffer } from "@/lib/services/document-parser";
import { generateStrategyMemo } from "@/lib/services/llm";
import type { AnalysisReport, NoticeRecord } from "@/lib/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/repositories/notices", () => ({
  createAnalysisReport: vi.fn(),
  getNotice: vi.fn(),
  listAnalysisReports: vi.fn()
}));

vi.mock("@/lib/services/document-parser", () => ({
  isSupportedDocumentFileName: vi.fn(
    (fileName: string) => fileName.endsWith(".pdf") || fileName.endsWith(".hwpx") || fileName.endsWith(".hwp")
  ),
  parseDocumentBuffer: vi.fn()
}));

vi.mock("@/lib/services/llm", () => ({
  generateStrategyMemo: vi.fn()
}));

const createAnalysisReportMock = vi.mocked(createAnalysisReport);
const generateStrategyMemoMock = vi.mocked(generateStrategyMemo);
const getNoticeMock = vi.mocked(getNotice);
const isSupportedDocumentFileNameMock = vi.mocked(isSupportedDocumentFileName);
const listAnalysisReportsMock = vi.mocked(listAnalysisReports);
const parseDocumentBufferMock = vi.mocked(parseDocumentBuffer);
const revalidatePathMock = vi.mocked(revalidatePath);

describe("attachment analysis route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads a selected PDF attachment and creates an analysis report", async () => {
    const notice = createNotice();
    getNoticeMock.mockResolvedValueOnce(notice);
    listAnalysisReportsMock.mockResolvedValueOnce([]);
    parseDocumentBufferMock.mockResolvedValueOnce({
      markdown: "# 제안요청서",
      metadata: {}
    });
    generateStrategyMemoMock.mockResolvedValueOnce({
      provider: "mock",
      memo: "분석 결과"
    });
    createAnalysisReportMock.mockResolvedValueOnce(createReport());
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("pdf-body", {
        status: 200,
        headers: {
          "content-type": "application/pdf"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest(), createContext("1"));

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("analysis")).toBe("done");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&fileSeq=1"),
      expect.objectContaining({
        cache: "no-store",
        redirect: "follow",
        headers: expect.objectContaining({
          referer: notice.url
        })
      })
    );
    expect(parseDocumentBufferMock).toHaveBeenCalledWith("입찰공고문.pdf", expect.any(Buffer));
    expect(generateStrategyMemoMock).toHaveBeenCalledWith({
      notice,
      documentMarkdown: "# 제안요청서"
    });
    expect(createAnalysisReportMock).toHaveBeenCalledWith({
      noticeId: notice.id,
      fileName: "입찰공고문.pdf",
      fileType: "application/pdf",
      documentMarkdown: "# 제안요청서",
      strategyMemo: "분석 결과",
      modelProvider: "mock"
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/notices/${encodeURIComponent(notice.id)}`);
  });

  it("redirects with an error for unsupported selected attachments", async () => {
    getNoticeMock.mockResolvedValueOnce(createNotice());
    isSupportedDocumentFileNameMock.mockReturnValueOnce(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest(), createContext("2"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(303);
    expect(location.searchParams.get("analysisError")).toBe("PDF, HWPX 또는 HWP 첨부파일만 분석할 수 있습니다.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parseDocumentBufferMock).not.toHaveBeenCalled();
    expect(generateStrategyMemoMock).not.toHaveBeenCalled();
  });

  it("skips duplicate analysis for a file that already has a report", async () => {
    getNoticeMock.mockResolvedValueOnce(createNotice());
    listAnalysisReportsMock.mockResolvedValueOnce([createReport()]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest(), createContext("1"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(303);
    expect(location.searchParams.get("analysis")).toBe("existing");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parseDocumentBufferMock).not.toHaveBeenCalled();
    expect(generateStrategyMemoMock).not.toHaveBeenCalled();
    expect(createAnalysisReportMock).not.toHaveBeenCalled();
  });

  it("redirects with a clear error when LLM analysis fails", async () => {
    const notice = createNotice();
    getNoticeMock.mockResolvedValueOnce(notice);
    listAnalysisReportsMock.mockResolvedValueOnce([]);
    parseDocumentBufferMock.mockResolvedValueOnce({
      markdown: "# 제안요청서",
      metadata: {}
    });
    generateStrategyMemoMock.mockRejectedValueOnce(new Error("OpenAI API 오류: HTTP 429"));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("pdf-body", {
        status: 200,
        headers: {
          "content-type": "application/pdf"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest(), createContext("1"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(303);
    expect(location.searchParams.get("analysisError")).toBe("OpenAI API 오류: HTTP 429");
    expect(createAnalysisReportMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/notices/g2b_R26BK01581845-000/attachments/1/analyze", {
    method: "POST",
    headers: {
      "user-agent": "vitest"
    }
  });
}

function createContext(sequence: string): { params: Promise<{ id: string; sequence: string }> } {
  return {
    params: Promise.resolve({
      id: "g2b_R26BK01581845-000",
      sequence
    })
  };
}

function createNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: "g2b_R26BK01581845-000",
    sourceId: "g2b",
    externalId: "R26BK01581845-000",
    title: "인체 의료영상데이터 DB 구축 및 움직임 3D 시각화",
    url: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK01581845&bidPbancOrd=000",
    organization: "한국과학기술정보연구원",
    deadlineAt: "2026-06-26T01:00:00.000Z",
    budgetAmount: 100000000,
    category: "bid",
    rawKeywordsText: "정보시스템",
    matchedKeywords: ["정보시스템"],
    score: 12,
    scoreReason: "정보시스템 키워드가 공고 내용과 맞습니다.",
    metadata: {
      detail: {
        attachments: [
          {
            sequence: 1,
            name: "입찰공고문.pdf",
            url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&fileSeq=1"
          },
          {
            sequence: 2,
            name: "제안요청서.hwp",
            url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&fileSeq=2"
          }
        ]
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slackNotified: false,
    ...overrides
  };
}

function createReport(): AnalysisReport {
  return {
    id: 1,
    noticeId: "g2b_R26BK01581845-000",
    fileName: "입찰공고문.pdf",
    fileType: "application/pdf",
    documentMarkdown: "# 제안요청서",
    strategyMemo: "분석 결과",
    modelProvider: "mock",
    createdAt: new Date().toISOString()
  };
}
