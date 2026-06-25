import { describe, expect, it } from "vitest";
import { matchKeywords, scoreNoticeText } from "@/lib/scoring";

describe("scoring", () => {
  describe("generic keywords stay weak alone", () => {
    it("does not give S-100 a strong signal by itself", () => {
      const result = scoreNoticeText("S-100 관련 안내");

      expect(result.breakdown.standardsScore).toBeLessThanOrEqual(6);
      expect(result.breakdown.combinationBonus).toBe(0);
      expect(result.score).toBeLessThan(20);
    });

    it("does not give GIS a strong signal by itself", () => {
      const result = scoreNoticeText("GIS 관련 문의");

      expect(result.breakdown.technicalScore).toBeLessThanOrEqual(4);
      expect(result.breakdown.combinationBonus).toBe(0);
      expect(result.score).toBeLessThan(15);
    });

    it("does not let DB, platform, AI or 구축/용역 alone create a strong candidate", () => {
      const result = scoreNoticeText("일반 쇼핑몰 플랫폼 구축");

      expect(result.breakdown.combinationBonus).toBe(0);
      expect(result.score).toBeLessThanOrEqual(10);
      expect(result.matchedKeywords).toEqual(expect.arrayContaining(["플랫폼", "구축"]));
    });
  });

  describe("tiered combination bonuses: only the highest matched tier applies", () => {
    it("tiers the S-100 family by how many context signals match", () => {
      expect(scoreNoticeText("S-100 IHO").breakdown.combinationBonus).toBe(30);
      expect(scoreNoticeText("S-100 IHO 데이터셋").breakdown.combinationBonus).toBe(50);
      expect(scoreNoticeText("S-100 IHO 데이터셋 검증").breakdown.combinationBonus).toBe(80);
      expect(scoreNoticeText("S-100 수로제품 데이터셋 검증").breakdown.combinationBonus).toBe(80);
    });

    it("tiers the GIS + DB family by how many context signals match", () => {
      expect(scoreNoticeText("GIS DB").breakdown.combinationBonus).toBe(25);
      expect(scoreNoticeText("GIS DB 공간정보").breakdown.combinationBonus).toBe(50);
      expect(scoreNoticeText("GIS DB 해양공간정보 구축").breakdown.combinationBonus).toBe(75);
    });

    it("tiers the VTS + 디지털 family by how many context signals match", () => {
      expect(scoreNoticeText("VTS 디지털").breakdown.combinationBonus).toBe(30);
      expect(scoreNoticeText("VTS 디지털 국제표준").breakdown.combinationBonus).toBe(50);
      expect(scoreNoticeText("VTS 디지털 국제표준 서비스").breakdown.combinationBonus).toBe(78);
    });

    it("tiers the 항로표지 + 스마트 family by how many context signals match", () => {
      expect(scoreNoticeText("항로표지 스마트").breakdown.combinationBonus).toBe(30);
      expect(scoreNoticeText("항로표지 스마트 연계기술").breakdown.combinationBonus).toBe(60);
      expect(scoreNoticeText("항로표지 스마트 연계기술 개발").breakdown.combinationBonus).toBe(78);
    });

    it("never stacks multiple tiers of the same family (no double-counting)", () => {
      const result = scoreNoticeText("S-100 IHO 데이터셋 검증");

      // Would be 30 + 50 + 80 = 160 if every satisfied tier stacked; only the highest applies.
      expect(result.breakdown.combinationBonus).toBe(80);
      expect(result.breakdown.appliedCombinationBonuses).toHaveLength(1);
    });
  });

  describe("high score: tiered combination bonuses push BlueMap-relevant context to 80-100", () => {
    it("scores IHO S-100 기반 전자해도 데이터셋 검증도구 개발 at 90+", () => {
      const result = scoreNoticeText("IHO S-100 기반 전자해도 데이터셋 검증도구 개발");

      expect(result.breakdown.combinationBonus).toBe(80);
      expect(result.breakdown.matchedStandardsSignals).toEqual(expect.arrayContaining(["S-100", "IHO"]));
      expect(result.breakdown.matchedDomainSignals).toEqual(expect.arrayContaining(["전자해도"]));
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it("scores S-100 수로제품 데이터셋 검증 at 85+", () => {
      const result = scoreNoticeText("S-100 수로제품 데이터셋 검증");

      expect(result.breakdown.combinationBonus).toBe(80);
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it("scores 해양공간정보 기반 GIS DB 구축 용역 at 85+", () => {
      const result = scoreNoticeText("해양공간정보 기반 GIS DB 구축 용역");

      expect(result.breakdown.combinationBonus).toBe(75);
      expect(result.breakdown.matchedTechnicalSignals).toEqual(expect.arrayContaining(["GIS", "DB"]));
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it("scores 디지털 VTS 국제표준 서비스 개발 at 80+", () => {
      const result = scoreNoticeText("디지털 VTS 국제표준 서비스 개발");

      expect(result.breakdown.combinationBonus).toBe(78);
      expect(result.breakdown.matchedTechnicalSignals).toEqual(expect.arrayContaining(["VTS"]));
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("scores 스마트 항로표지 및 연계기술 개발 at 80+", () => {
      const result = scoreNoticeText("스마트 항로표지 및 연계기술 개발");

      expect(result.breakdown.combinationBonus).toBe(78);
      expect(result.breakdown.matchedDomainSignals).toEqual(expect.arrayContaining(["항로표지"]));
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe("final score is capped at 100", () => {
    it("clamps a notice that stacks multiple strong combo families to exactly 100", () => {
      const result = scoreNoticeText(
        "IHO S-100 기반 전자해도 데이터셋 검증도구 개발 해양공간정보 기반 GIS DB 구축 용역"
      );

      expect(result.score).toBe(100);
    });
  });

  describe("low score / noise: equipment codes, procurement and excluded contract types", () => {
    it("does not let SPS-1000 false-match S-100 and scores equipment maintenance as noise", () => {
      const result = scoreNoticeText("조기경보(SPS-1000) 자동점검장비 유지보수");

      expect(matchKeywords("조기경보(SPS-1000) 자동점검장비 유지보수", ["S-100"])).not.toContain("S-100");
      expect(result.breakdown.standardsScore).toBe(0);
      expect(result.breakdown.matchedNoiseSignals).toEqual(expect.arrayContaining(["sps-1000"]));
      expect(result.score).toBe(0);
    });

    it("treats SPS-100K/300K equipment data purchases as noise, not S-100", () => {
      const result = scoreNoticeText("20년 SPS-100K,300K 데이터 부품 구매");

      expect(result.breakdown.standardsScore).toBe(0);
      expect(result.breakdown.matchedNoiseSignals.length).toBeGreaterThan(0);
      expect(result.score).toBe(0);
    });

    it("does not let GPS-100 false-match S-100", () => {
      const result = scoreNoticeText("케이블조립체(GPS-100)");

      expect(result.breakdown.standardsScore).toBe(0);
      expect(result.breakdown.matchedNoiseSignals).toEqual(expect.arrayContaining(["gps-100"]));
      expect(result.score).toBe(0);
    });

    it("does not treat electrical switchgear GIS (변전소/154kV) as geospatial GIS", () => {
      const result = scoreNoticeText("변전소 154kV GIS설비 정비공사");

      expect(matchKeywords("변전소 154kV GIS설비 정비공사", ["GIS"])).not.toContain("GIS");
      expect(result.breakdown.technicalScore).toBe(0);
      expect(result.breakdown.combinationBonus).toBe(0);
      expect(result.breakdown.matchedNoiseSignals.length).toBeGreaterThan(0);
      expect(result.score).toBe(0);
    });

    it("keeps GIST research equipment maintenance at zero", () => {
      const result = scoreNoticeText("GIST 연구장비통합관리시스템 유지보수 및 기능개선 사업");

      expect(matchKeywords("GIST 연구장비통합관리시스템 유지보수 및 기능개선 사업", ["GIS"])).not.toContain("GIS");
      expect(result.breakdown.technicalScore).toBe(0);
      expect(result.breakdown.combinationBonus).toBe(0);
      expect(result.score).toBe(0);
    });

    it("excludes 수의시담/다자간수의시담 notices regardless of other signals", () => {
      const result = scoreNoticeText("해양공간정보 GIS DB 구축 수의시담/계약대상자 외 참가 불가 공고");

      expect(result.breakdown.excluded).toBe(true);
      expect(result.score).toBe(0);
      expect(result.reason).toContain("수의시담");
    });
  });

  describe("ranking separation", () => {
    it("ranks BlueMap-relevant combination notices well above isolated generic-keyword and noise notices", () => {
      const highScoreTexts = [
        "IHO S-100 기반 전자해도 데이터셋 검증도구 개발",
        "S-100 수로제품 데이터셋 검증",
        "해양공간정보 기반 GIS DB 구축 용역",
        "스마트 항로표지 및 연계기술 개발",
        "디지털 VTS 국제표준 서비스 개발"
      ];
      const lowOrNoiseTexts = [
        "GIST 연구장비통합관리시스템 유지보수 및 기능개선 사업",
        "조기경보(SPS-1000) 자동점검장비 유지보수",
        "20년 SPS-100K,300K 데이터 부품 구매",
        "케이블조립체(GPS-100)",
        "변전소 154kV GIS설비 정비공사",
        "일반 쇼핑몰 플랫폼 구축",
        "수의시담/계약대상자 외 참가 불가 공고"
      ];

      const minHighScore = Math.min(...highScoreTexts.map((text) => scoreNoticeText(text).score));
      const maxLowScore = Math.max(...lowOrNoiseTexts.map((text) => scoreNoticeText(text).score));

      expect(minHighScore).toBeGreaterThan(maxLowScore);
      expect(minHighScore).toBeGreaterThanOrEqual(80);
      expect(maxLowScore).toBeLessThanOrEqual(10);
    });
  });

  describe("explainability", () => {
    it("returns a full breakdown with matched signals, combination bonuses and noise penalties", () => {
      const result = scoreNoticeText("해양공간정보 기반 GIS DB 구축 용역");

      expect(result.breakdown).toMatchObject({
        excluded: false
      });
      expect(result.breakdown.matchedDomainSignals.length).toBeGreaterThan(0);
      expect(result.breakdown.matchedTechnicalSignals).toEqual(expect.arrayContaining(["GIS", "DB"]));
      expect(result.breakdown.matchedBusinessTypeSignals).toEqual(expect.arrayContaining(["구축", "용역"]));
      expect(result.breakdown.appliedCombinationBonuses.length).toBeGreaterThan(0);
      expect(result.breakdown.noisePenalty).toBe(0);
      expect(typeof result.breakdown.domainScore).toBe("number");
      expect(typeof result.breakdown.standardsScore).toBe("number");
      expect(typeof result.breakdown.technicalScore).toBe("number");
      expect(typeof result.breakdown.businessTypeScore).toBe("number");
      expect(typeof result.breakdown.agencyScore).toBe("number");

      const uncappedTotal =
        result.breakdown.domainScore +
        result.breakdown.standardsScore +
        result.breakdown.technicalScore +
        result.breakdown.businessTypeScore +
        result.breakdown.agencyScore -
        result.breakdown.noisePenalty;

      expect(result.score).toBe(Math.min(100, uncappedTotal));
    });
  });

  describe("token boundaries", () => {
    it("matches GIS only as a standalone token, not as a substring", () => {
      expect(matchKeywords("GIS DB 구축용역")).toContain("GIS");
      expect(matchKeywords("공간정보 GIS 구축")).toContain("GIS");
      expect(matchKeywords("GIST 연구용역")).not.toContain("GIS");
      expect(matchKeywords("Gwangju Institute of Science and Technology")).not.toContain("GIS");
    });
  });
});
