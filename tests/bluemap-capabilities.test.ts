import { describe, expect, it } from "vitest";
import {
  buildBluemapRecommendationReason,
  buildBluemapScoreReason,
  buildNoticeCapabilitySearchText,
  matchBluemapCapabilities
} from "@/lib/bluemap-capabilities";
import type { NoticeRecord } from "@/lib/types";

describe("bluemap capability profile", () => {
  it("matches marine GIS strengths from notice and document text", () => {
    const matches = matchBluemapCapabilities("해양공간정보 GIS 플랫폼과 OpenLayers 기반 2D 지도 화면을 구축한다.");

    expect(matches[0].title).toBe("GIS 기반 해양공간정보 서비스 기술");
    expect(matches[0].matchedKeywords).toEqual(expect.arrayContaining(["GIS", "해양공간정보", "OpenLayers"]));
  });

  it("matches VTS and maritime traffic monitoring strengths", () => {
    const matches = matchBluemapCapabilities("디지털 VTS 관제시스템에서 S-210 IVEF 데이터를 연계하고 모니터링 화면을 제공한다.");

    expect(matches[0].title).toBe("디지털 VTS 및 차세대 해사정보서비스 기술");
    expect(matches[0].matchedKeywords).toEqual(expect.arrayContaining(["VTS", "S-210", "IVEF", "모니터링"]));
  });

  it("builds recommendation reasons with Bluemap-specific evidence", () => {
    const reason = buildBluemapRecommendationReason(createNotice());

    expect(reason).toContain("블루맵 기술특장점 기준");
    expect(reason).toContain("GIS 기반 해양공간정보 서비스 기술");
    expect(reason).toContain("표준 데이터 처리 경험");
  });

  it("adds capability evidence to score reasons when keywords match", () => {
    const reason = buildBluemapScoreReason("S-100 전자해도 데이터 제품 검증 시스템 구축", ["S-100", "전자해도", "시스템 구축"]);

    expect(reason).toContain("S-100, 전자해도, 시스템 구축 키워드");
    expect(reason).toContain("S-100 국제표준 기반 차세대 수로제품 기술");
  });

  it("keeps weak capability matches conservative", () => {
    const reason = buildBluemapRecommendationReason(
      createNotice({
        title: "재난정보시스템 서버 가상화 구축",
        rawKeywordsText: "재난정보시스템 서버 가상화 구축",
        matchedKeywords: ["정보시스템"],
        scoreReason: "정보시스템 키워드가 공고 내용과 맞습니다."
      })
    );

    expect(reason).toContain("직접 연결되는 신호가 제한적");
    expect(reason).toContain("첨부문서에서");
  });

  it("builds a search text from notice and document fields", () => {
    const text = buildNoticeCapabilitySearchText(createNotice(), "첨부문서: WMS API 연계");

    expect(text).toContain("해양공간정보 GIS 플랫폼 고도화 용역");
    expect(text).toContain("WMS API 연계");
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
    rawKeywordsText: "해양공간정보 GIS 플랫폼 WMS",
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
