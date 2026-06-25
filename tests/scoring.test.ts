import { describe, expect, it } from "vitest";
import { matchKeywords, scoreNoticeText } from "@/lib/scoring";

describe("scoring", () => {
  it("matches Bluemap keywords with equal inclusion rules", () => {
    const matches = matchKeywords("해양공간정보 기반 GIS 플랫폼 구축 용역");

    expect(matches).toContain("해양");
    expect(matches).toContain("해양공간정보");
    expect(matches).toContain("GIS");
    expect(matches).toContain("플랫폼");
  });

  it("scores high when core Bluemap capabilities and delivery context align", () => {
    const result = scoreNoticeText("S-100 전자해도 해양공간정보 GIS 플랫폼 구축 용역");

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.breakdown).toMatchObject({
      capabilityScore: 38,
      generalTechScore: 19,
      contextScore: 12,
      riskPenalty: 0
    });
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(["S-100", "전자해도", "해양공간정보", "GIS", "플랫폼", "구축", "용역"])
    );
    expect(result.reason).toContain("핵심역량 38점");
    expect(result.reason).toContain("일반기술 19점");
    expect(result.reason).toContain("과업맥락 12점");
  });

  it("keeps broad platform notices as low-priority helper signals", () => {
    const result = scoreNoticeText("플랫폼 구축");

    expect(result.score).toBe(11);
    expect(result.breakdown).toMatchObject({
      capabilityScore: 0,
      generalTechScore: 4,
      contextScore: 7,
      riskPenalty: 0
    });
    expect(result.matchedKeywords).toEqual(expect.arrayContaining(["플랫폼", "구축"]));
  });

  it("subtracts risk for non-IT construction or purchase context", () => {
    const result = scoreNoticeText("복합플랫폼 건축공사");

    expect(result.score).toBe(0);
    expect(result.breakdown.riskPenalty).toBe(13);
    expect(result.matchedKeywords).toEqual(expect.arrayContaining(["플랫폼", "건축공사", "공사"]));
    expect(result.reason).toContain("리스크 -13점");
  });

  it("returns zero when only risk signals match", () => {
    const result = scoreNoticeText("사무용 의자 구매");

    expect(result.score).toBe(0);
    expect(result.matchedKeywords).toEqual(["구매"]);
    expect(result.reason).toContain("리스크 -8점");
  });

  it("uses operator-managed keywords as candidate signals without direct score inflation", () => {
    const result = scoreNoticeText("AI 기반 해저 케이블 관제 플랫폼", ["해저 케이블", "관제"]);

    expect(result.score).toBe(10);
    expect(result.breakdown.generalTechScore).toBe(10);
    expect(result.matchedKeywords).toEqual(["해저 케이블", "관제", "플랫폼"]);
  });

  it("matches GIS only as a standalone token, not as a substring", () => {
    expect(matchKeywords("GIS DB 구축용역")).toContain("GIS");
    expect(matchKeywords("공간정보 GIS 구축")).toContain("GIS");
    expect(matchKeywords("하수관로 GIS DB 정확도 개선")).toContain("GIS");

    expect(matchKeywords("GIST 연구용역")).not.toContain("GIS");
    expect(matchKeywords("GIST대학 산학협력 용역")).not.toContain("GIS");
    expect(matchKeywords("Gwangju Institute of Science and Technology")).not.toContain("GIS");
  });

  it("does not treat electrical switchgear GIS as a geospatial signal", () => {
    const result = scoreNoticeText("변전소 GIS설비 정비공사");

    expect(matchKeywords("변전소 GIS설비 정비공사")).not.toContain("GIS");
    expect(result.matchedKeywords).not.toContain("GIS");
    expect(result.breakdown.generalTechScore).toBe(0);
    expect(result.score).toBe(0);
  });
});
