import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/notices/[id]/attachments/[sequence]/download/route";
import { getNotice } from "@/lib/repositories/notices";
import { buildDownloadHeaders, findNoticeAttachment, validateG2bDownloadUrl } from "@/lib/services/attachment-download";
import type { NoticeRecord } from "@/lib/types";

vi.mock("@/lib/repositories/notices", () => ({
  getNotice: vi.fn()
}));

const getNoticeMock = vi.mocked(getNotice);

describe("attachment download proxy", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("finds an attachment by sequence from notice metadata", () => {
    const attachment = findNoticeAttachment(createNotice().metadata, 2);

    expect(attachment).toEqual({
      sequence: 2,
      name: "제안요청서.hwp",
      url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&bidPbancOrd=000&fileSeq=2"
    });
  });

  it("allows only G2B attachment download URLs", () => {
    expect(() =>
      validateG2bDownloadUrl("https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?fileSeq=1")
    ).not.toThrow();

    expect(() => validateG2bDownloadUrl("https://example.com/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?fileSeq=1")).toThrow(
      "나라장터 첨부파일만 다운로드할 수 있습니다."
    );
    expect(() => validateG2bDownloadUrl("http://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?fileSeq=1")).toThrow(
      "나라장터 HTTPS 첨부파일만 다운로드할 수 있습니다."
    );
  });

  it("builds safe download headers with Korean filenames", () => {
    const headers = buildDownloadHeaders(new Headers({ "content-type": "application/pdf", "content-length": "10" }), "입찰공고문.pdf");

    expect(headers.get("content-type")).toBe("application/pdf");
    expect(headers.get("content-length")).toBe("10");
    expect(headers.get("content-disposition")).toContain("attachment;");
    expect(headers.get("content-disposition")).toContain("filename*=UTF-8''%EC%9E%85%EC%B0%B0%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf");
  });

  it("streams a G2B attachment through the local API", async () => {
    getNoticeMock.mockResolvedValueOnce(createNotice());
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("file-body", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-length": "9"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(createRequest(), createContext("2"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("file-body");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''%EC%A0%9C%EC%95%88%EC%9A%94%EC%B2%AD%EC%84%9C.hwp");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&bidPbancOrd=000&fileSeq=2");
    expect(init).toEqual(
      expect.objectContaining({
        cache: "no-store",
        redirect: "follow",
        headers: expect.objectContaining({
          referer: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK01581845&bidPbancOrd=000"
        })
      })
    );
  });

  it("rejects unsafe attachment URLs before fetching", async () => {
    getNoticeMock.mockResolvedValueOnce(
      createNotice({
        metadata: {
          detail: {
            attachments: [
              {
                sequence: 1,
                name: "bad.pdf",
                url: "https://example.com/file.pdf"
              }
            ]
          }
        }
      })
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(createRequest(), createContext("1"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "나라장터 첨부파일만 다운로드할 수 있습니다." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a readable error when the upstream download fails", async () => {
    getNoticeMock.mockResolvedValueOnce(createNotice());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("forbidden", {
          status: 403
        })
      )
    );

    const response = await GET(createRequest(), createContext("2"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "나라장터 첨부파일 다운로드에 실패했습니다. (HTTP 403)" });
  });
});

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/notices/g2b_R26BK01581845-000/attachments/2/download", {
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
            url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&bidPbancOrd=000&fileSeq=1"
          },
          {
            sequence: 2,
            name: "제안요청서.hwp",
            url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01581845&bidPbancOrd=000&fileSeq=2"
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
