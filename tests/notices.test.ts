import { describe, expect, it } from "vitest";
import { isExcludedFromSlackNotification } from "@/lib/repositories/notices";
import { shouldExcludeNoticeCandidate } from "@/lib/notice-rules";
import type { NormalizedNotice } from "@/lib/types";

describe("notice repository helpers", () => {
  it("excludes private negotiation notices from Slack notifications", () => {
    expect(isExcludedFromSlackNotification({ winnerMethod: "수의시담" })).toBe(true);
    expect(isExcludedFromSlackNotification({ winnerMethod: "수의시담 후 계약" })).toBe(true);
  });

  it("keeps ordinary winner methods eligible for Slack notifications", () => {
    expect(isExcludedFromSlackNotification({ winnerMethod: "협상에 의한 계약" })).toBe(false);
    expect(isExcludedFromSlackNotification({ winnerMethod: "적격심사" })).toBe(false);
    expect(isExcludedFromSlackNotification({})).toBe(false);
  });

  it("excludes private negotiation notices from candidate processing", () => {
    expect(shouldExcludeNoticeCandidate(createNotice({ winnerMethod: "수의시담" }))).toBe(true);
    expect(shouldExcludeNoticeCandidate(createNotice({ winnerMethod: "협상에 의한 계약" }))).toBe(false);
  });

  it("excludes non-IT construction notices matched only by broad domain keywords", () => {
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "공사",
          title: "탈염처리실 및 별관 시설정비 공사",
          rawKeywordsText: "국가유산청 국립해양유산연구소 탈염처리실 및 별관 시설정비 공사",
          matchedKeywords: ["해양"]
        })
      )
    ).toBe(true);
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "공사",
          title: "구산면 해양관광로 일원 호안 복구공사",
          rawKeywordsText: "경상남도 창원시 구산면 해양관광로 일원 호안 복구공사",
          matchedKeywords: ["해양"]
        })
      )
    ).toBe(true);
  });

  it("excludes non-IT purchase notices such as spare parts and fuel", () => {
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "물품",
          title: "수리소요 기관부속 및 예비품 구매",
          rawKeywordsText: "해양경찰청 기관부속 예비품 구매",
          matchedKeywords: ["해양"]
        })
      )
    ).toBe(true);
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "물품",
          title: "해양환경공단 대산지사 선박용 연료유 구매",
          rawKeywordsText: "해양환경공단 선박용 연료유 구매",
          matchedKeywords: ["해양", "선박"]
        })
      )
    ).toBe(true);
  });

  it("keeps IT system and GIS notices even when the business division is goods or construction", () => {
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "물품",
          title: "재난정보시스템 서버 가상화 구축 (SW 도입)",
          rawKeywordsText: "재난정보시스템 서버 가상화 구축 SW 도입",
          matchedKeywords: ["정보시스템"]
        })
      )
    ).toBe(false);
    expect(
      shouldExcludeNoticeCandidate(
        createNotice({
          businessDivision: "공사",
          title: "해양공간정보 GIS 플랫폼 구축 공사",
          rawKeywordsText: "해양공간정보 GIS 플랫폼 구축 공사",
          matchedKeywords: ["해양", "해양공간정보", "GIS", "플랫폼"]
        })
      )
    ).toBe(false);
  });

  it("uses operator-managed exclusion and IT signal rules", () => {
    const notice = createNotice({
      businessDivision: "용역",
      title: "해양 데이터맵 제작 용역",
      rawKeywordsText: "해양 데이터맵 제작 용역",
      matchedKeywords: ["해양"]
    });

    expect(
      shouldExcludeNoticeCandidate(notice, {
        itRelevantKeywords: [],
        nonItExclusionKeywords: ["제작 용역"]
      })
    ).toBe(true);
    expect(
      shouldExcludeNoticeCandidate(notice, {
        itRelevantKeywords: ["데이터맵"],
        nonItExclusionKeywords: ["제작 용역"]
      })
    ).toBe(false);
  });
});

function createNotice(overrides: Partial<NormalizedNotice["metadata"]> & Partial<NormalizedNotice> = {}): NormalizedNotice {
  const {
    title = "테스트 공고",
    rawKeywordsText = "해양 GIS",
    matchedKeywords = ["해양", "GIS"],
    ...metadata
  } = overrides;

  return {
    sourceId: "g2b",
    externalId: "R26BK01578027-000",
    title,
    url: "https://www.g2b.go.kr",
    category: "bid",
    rawKeywordsText,
    matchedKeywords,
    score: 24,
    scoreReason: "해양, GIS 키워드가 공고 내용과 맞습니다.",
    metadata
  };
}
