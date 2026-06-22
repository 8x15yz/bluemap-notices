import { describe, expect, it, vi, afterEach } from "vitest";
import {
  generateProposalDraft,
  generateSlackThreadAnswer,
  generateStrategyMemo,
  reviseProposalDraft
} from "@/lib/services/llm";
import type { AnalysisReport, NoticeRecord } from "@/lib/types";

describe("llm strategy memo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a structured mock strategy memo for proposal decisions", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await generateStrategyMemo({
      notice: createNotice(),
      documentMarkdown: [
        "# 제안요청서",
        "참가자격: 최근 3년 이내 공간정보 시스템 구축 실적을 보유해야 합니다.",
        "과업 범위: 해양공간정보 데이터 구축, API 연계, 운영 화면 개발을 포함합니다.",
        "데이터 연계: 기존 DB와 외부 API를 연계하고 관리자 화면에서 검증합니다.",
        "산출물: 착수보고서, 중간보고서, 완료보고서, 소스코드, 운영 매뉴얼을 제출합니다.",
        "평가: 기술능력평가와 가격평가를 합산해 협상대상자를 선정합니다."
      ].join("\n")
    });

    expect(result.provider).toBe("mock");
    expect(result.memo).toContain("## 1. 한 줄 판단");
    expect(result.memo).toContain("조건부 검토 (적합도: 36점)");
    expect(result.memo).toContain("## 4. 발주 요구와 블루맵 대응 매핑");
    expect(result.memo).toContain("| 데이터/시스템 연계 |");
    expect(result.memo).toContain("| 마감/일정(한국시간) |");
    expect(result.memo).toContain("(KST)");
    expect(result.memo).toContain("공고 예산 100,000,000원");
    expect(result.memo).toContain("GIS 기반 해양공간정보 서비스 기술");
    expect(result.memo).toContain("공간정보 시스템 구축 실적");
    expect(result.memo).toContain("## 7. 제안서 문장 후보");
    expect(result.memo).toContain("블루맵은");
    expect(result.memo).toContain("- [ ] 첨부문서에서 참가자격");
  });

  it("marks missing document evidence as needing confirmation", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await generateStrategyMemo({
      notice: createNotice({
        score: 0,
        matchedKeywords: [],
        budgetAmount: undefined,
        deadlineAt: undefined
      }),
      documentMarkdown: "요약 문서"
    });

    expect(result.memo).toContain("참여 비권고 (적합도: 0점)");
    expect(result.memo).toContain("문서에서 확인 필요");
  });

  it("calls the OpenAI Responses API when OpenAI provider and key are configured", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-test-model");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: "## OpenAI 분석 결과" }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStrategyMemo({
      notice: createNotice({
        budgetAmount: 100000000,
        deadlineAt: "2026-07-01T09:00:00.000Z",
        metadata: {
          detail: {
            assignedBudget: 120000000,
            estimatedPrice: 110000000,
            contractMethod: "제한경쟁",
            awardMethod: "협상에의한계약"
          }
        }
      }),
      documentMarkdown: "# 제안요청서"
    });

    expect(result.provider).toBe("openai");
    expect(result.memo).toBe("## OpenAI 분석 결과");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-openai-key",
          "Content-Type": "application/json"
        })
      })
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      model: string;
      input: string;
    };
    expect(requestBody.model).toBe("gpt-test-model");
    expect(requestBody.input).toContain("해양공간정보 GIS 플랫폼");
    expect(requestBody.input).toContain("- 마감(한국시간):");
    expect(requestBody.input).toContain("(KST)");
    expect(requestBody.input).toContain("공고 예산 100,000,000원");
    expect(requestBody.input).toContain("배정 예산 120,000,000원");
    expect(requestBody.input).toContain("추정 가격 110,000,000원");
    expect(requestBody.input).toContain("- 계약 방식: 제한경쟁");
    expect(requestBody.input).toContain("- 낙찰 방식: 협상에의한계약");
  });

  it("calls the OpenAI Responses API for Slack thread Q&A with notice context", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-test-model");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: "**2번 공고**는 `플랫폼 구축 포지션`으로 보되 과업 범위 확인이 먼저입니다." }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateSlackThreadAnswer({
      itemIndex: 2,
      notice: createNotice({
        title: "학천지구 복합플랫폼 구축사업(건축공사)",
        matchedKeywords: ["플랫폼"],
        score: 12,
        scoreReason: "플랫폼 키워드가 공고 내용과 맞습니다."
      }),
      questionText: "2번 공고의 제안 전략에 대해서 알려줘"
    });

    expect(result.provider).toBe("openai");
    expect(result.answer).toContain("*2번 공고*");
    expect(result.answer).toContain("플랫폼 구축 포지션");
    expect(result.answer).not.toContain("**");
    expect(result.answer).not.toContain("`");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      model: string;
      input: string;
    };
    expect(requestBody.model).toBe("gpt-test-model");
    expect(requestBody.input).toContain("Slack 봇");
    expect(requestBody.input).toContain("2번 공고의 제안 전략");
    expect(requestBody.input).toContain("학천지구 복합플랫폼 구축사업");
    expect(requestBody.input).toContain("적합도 점수: 12점");
  });

  it("uses clear decision labels with score context", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    await expect(
      generateStrategyMemo({
        notice: createNotice({ score: 80 }),
        documentMarkdown: "제안요청서"
      }).then((result) => result.memo)
    ).resolves.toContain("강력 권고 (적합도: 80점)");

    await expect(
      generateStrategyMemo({
        notice: createNotice({ score: 60 }),
        documentMarkdown: "제안요청서"
      }).then((result) => result.memo)
    ).resolves.toContain("참여 권고 (적합도: 60점)");

    await expect(
      generateStrategyMemo({
        notice: createNotice({ score: 12 }),
        documentMarkdown: "제안요청서"
      }).then((result) => result.memo)
    ).resolves.toContain("낮은 우선순위 (적합도: 12점)");
  });

  it("cleans extracted HTML table rows before placing them in the memo", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await generateStrategyMemo({
      notice: createNotice(),
      documentMarkdown: [
        "<tr><th>공고명</th><th colspan=\"2\">재난정보시스템 서버 가상화 구축 (SW 도입)</th></tr>",
        "<tr><td>납품장소</td><td>수요기관 지정장소</td><td>인도조건</td></tr>"
      ].join("\n")
    });

    expect(result.memo).not.toContain("<tr>");
    expect(result.memo).not.toContain("<td>");
    expect(result.memo).not.toContain("<th");
    expect(result.memo).toContain("공고명 / 재난정보시스템 서버 가상화 구축 (SW 도입)");
    expect(result.memo).toContain("납품장소 / 수요기관 지정장소 / 인도조건");
  });

  it("builds a proposal draft from request format and Bluemap capabilities", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await generateProposalDraft({
      notice: createNotice({ title: "인체 의료영상데이터 DB 구축 및 움직임 3D 시각화" }),
      analysisReport: createAnalysisReport()
    });

    expect(result.provider).toBe("mock");
    expect(result.assistantMessage).toBe("제안서 초안을 작성했습니다.");
    expect(result.contentMarkdown).toContain("# 제안서 초안");
    expect(result.contentMarkdown).toContain("## 2. 제안요청서 작성 양식 반영");
    expect(result.contentMarkdown).toContain("제안서 목차");
    expect(result.contentMarkdown).toContain("기술능력평가");
    expect(result.contentMarkdown).toContain("블루맵");
  });

  it("revises a proposal draft with the user request and current draft context", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await reviseProposalDraft({
      notice: createNotice(),
      analysisReport: createAnalysisReport(),
      currentDraft: "# 제안서 초안\n\n## 1. 제안 개요\n- 기존 내용",
      messages: [{ role: "assistant", content: "제안서 초안을 작성했습니다." }],
      userMessage: "3D 시각화 차별화 포인트를 더 강하게 써줘"
    });

    expect(result.provider).toBe("mock");
    expect(result.assistantMessage).toBe("요청을 반영해 제안서 초안을 갱신했습니다.");
    expect(result.contentMarkdown).toContain("기존 내용");
    expect(result.contentMarkdown).toContain("수정 반영 메모");
    expect(result.contentMarkdown).toContain("3D 시각화 차별화 포인트");
  });

  it("builds a mock Slack thread answer when no AI provider is configured", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const result = await generateSlackThreadAnswer({
      itemIndex: 2,
      notice: createNotice({
        title: "학천지구 복합플랫폼 구축사업(건축공사)",
        rawKeywordsText: "복합플랫폼 건축공사",
        matchedKeywords: ["플랫폼"],
        score: 12
      }),
      questionText: "2번 공고의 제안 전략에 대해서 알려줘"
    });

    expect(result.provider).toBe("mock");
    expect(result.answer).toContain("2번 공고");
    expect(result.answer).toContain("포지션");
    expect(result.answer).toContain("리스크");
  });
});

function createNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: "g2b_R25BK00933743_000",
    sourceId: "g2b",
    externalId: "R25BK00933743-000",
    title: "해양공간정보 GIS 플랫폼 고도화 용역",
    url: "https://www.g2b.go.kr/link/example",
    organization: "해양수산부",
    deadlineAt: "2026-07-01T09:00:00.000Z",
    budgetAmount: 100000000,
    category: "bid",
    rawKeywordsText: "해양공간정보 GIS 플랫폼",
    matchedKeywords: ["해양공간정보", "GIS", "플랫폼"],
    score: 36,
    scoreReason: "해양공간정보, GIS, 플랫폼 키워드가 공고 내용과 맞습니다.",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slackNotified: false,
    ...overrides
  };
}

function createAnalysisReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: 1,
    noticeId: "g2b_R25BK00933743_000",
    fileName: "제안요청서.hwpx",
    fileType: "application/hwpx",
    documentMarkdown: [
      "# 제안요청서",
      "제안서 목차: 제안 개요, 사업 이해도, 수행 전략, 기술 지원, 산출물 관리 순으로 작성한다.",
      "평가기준: 기술능력평가 90점, 가격평가 10점을 합산한다.",
      "제출서류: 제안서, 발표자료, 산출물 계획서, 실적 증명서를 제출한다.",
      "과업 범위: 의료영상데이터 DB 구축, 움직임 3D 시각화, 시스템 연계를 포함한다.",
      "데이터 연계: 기존 DB와 API를 연계하고 관리자 화면에서 검증한다.",
      "산출물: 착수보고서, 중간보고서, 완료보고서, 운영 매뉴얼을 제출한다."
    ].join("\n"),
    strategyMemo: "블루맵의 공간정보 데이터 모델링과 3D 시각화 수행 전략을 제안서에 반영한다.",
    modelProvider: "mock",
    createdAt: new Date().toISOString(),
    ...overrides
  };
}
