import { BLUEMAP_KEYWORDS } from "@/lib/config/keywords";
import type { NormalizedNotice } from "@/lib/types";

// Bump when scoreNoticeText's signal/combo logic changes meaningfully, so stored
// notice_scores rows can be traced back to the logic version that produced them.
export const SCORING_VERSION = "tiered-domain-combo-v1";

const MAX_DOMAIN_SCORE = 25;
const MAX_STANDARDS_SCORE = 20;
const MAX_TECHNICAL_SCORE = 20;
const MAX_BUSINESS_TYPE_SCORE = 15;
const MAX_AGENCY_SCORE = 10;
const MAX_NOISE_PENALTY = 30;

type ScoringDimension = "domain" | "standards" | "technical" | "businessType" | "agency" | "noise";
type ComboDimension = "domain" | "standards" | "technical";

interface ScoringSignal {
  keyword: string;
  points: number;
}

interface MatchedScoringSignal extends ScoringSignal {
  dimension: ScoringDimension;
}

interface ComboTier {
  /** Minimum number of distinct contextSignals that must match for this tier to apply. */
  minContextMatches: number;
  bonus: number;
}

interface ComboFamily {
  label: string;
  dimension: ComboDimension;
  /** Gate for the family: AND across groups, OR within a group. No bonus at all unless this matches. */
  coreGroups: string[][];
  /** Pool of context keywords; the number of distinct matches (not which ones) selects the tier. */
  contextSignals: string[];
  /** Only the single highest tier whose minContextMatches is satisfied is applied (no stacking). */
  tiers: ComboTier[];
}

interface AppliedCombo {
  label: string;
  dimension: ComboDimension;
  bonus: number;
  matchedContextSignals: string[];
}

const EXCLUSION_SIGNALS = ["수의시담", "다자간수의시담"];

export interface ScoreBreakdown {
  domainScore: number;
  standardsScore: number;
  technicalScore: number;
  businessTypeScore: number;
  agencyScore: number;
  noisePenalty: number;
  combinationBonus: number;
  matchedDomainSignals: string[];
  matchedStandardsSignals: string[];
  matchedTechnicalSignals: string[];
  matchedBusinessTypeSignals: string[];
  matchedAgencySignals: string[];
  matchedNoiseSignals: string[];
  appliedCombinationBonuses: string[];
  matchedSignals: string[];
  excluded: boolean;
  exclusionReason?: string;
}

export interface ScoreResult {
  score: number;
  matchedKeywords: string[];
  reason: string;
  breakdown: ScoreBreakdown;
}

// 해양/수로/공간정보 등 블루맵의 사업 분야를 가리키는 도메인 신호.
// 단일 키워드만으로는 약한 점수만 부여하고, 콤보 보너스로 강한 신호를 만든다.
const DOMAIN_SIGNALS: ScoringSignal[] = [
  { keyword: "해양", points: 3 },
  { keyword: "해양수산", points: 4 },
  { keyword: "항만", points: 3 },
  { keyword: "선박", points: 3 },
  { keyword: "운항", points: 3 },
  { keyword: "항로", points: 3 },
  { keyword: "전자해도", points: 10 },
  { keyword: "ENC", points: 6 },
  { keyword: "수로제품", points: 8 },
  { keyword: "제품사양", points: 3 },
  { keyword: "해양정보", points: 6 },
  { keyword: "해양데이터", points: 7 },
  { keyword: "해양공간정보", points: 9 },
  { keyword: "수로", points: 4 },
  { keyword: "수로조사", points: 6 },
  { keyword: "수로측량", points: 6 },
  { keyword: "해사", points: 4 },
  { keyword: "해상교통", points: 5 },
  { keyword: "자율운항", points: 5 },
  { keyword: "스마트항만", points: 5 },
  { keyword: "항행안전시설", points: 5 },
  { keyword: "항로표지", points: 8 },
  { keyword: "등대", points: 3 },
  { keyword: "부표", points: 3 },
  { keyword: "해양환경", points: 4 },
  { keyword: "해양조사", points: 4 },
  { keyword: "조위", points: 3 },
  { keyword: "조류", points: 3 },
  { keyword: "해류", points: 3 },
  { keyword: "국제표준", points: 4 }
];

// IHO/S-100 계열 등 표준 식별자. 짧고 일반화된 코드라서 단독으로는 약하게,
// ENC/전자해도/검증 같은 맥락 키워드와 함께 등장할 때만 콤보 보너스로 강해진다.
const STANDARDS_SIGNALS: ScoringSignal[] = [
  { keyword: "S-100", points: 4 },
  { keyword: "S100", points: 4 },
  { keyword: "S-101", points: 4 },
  { keyword: "S-102", points: 4 },
  { keyword: "S-104", points: 4 },
  { keyword: "S-111", points: 4 },
  { keyword: "S-122", points: 4 },
  { keyword: "S-124", points: 4 },
  { keyword: "S-128", points: 4 },
  { keyword: "S-200", points: 3 },
  { keyword: "S-201", points: 3 },
  { keyword: "S-210", points: 3 },
  { keyword: "S-212", points: 3 },
  { keyword: "S-412", points: 3 },
  { keyword: "S-500", points: 3 },
  { keyword: "S-63", points: 3 },
  { keyword: "S-64", points: 3 },
  { keyword: "S-98", points: 3 },
  { keyword: "S-164", points: 3 },
  { keyword: "IHO", points: 4 },
  { keyword: "IALA", points: 4 }
];

// GIS DB, 데이터셋/검증도구, 시뮬레이션, VTS, e-Navigation, 플랫폼, AI 등
// 블루맵이 실제로 다루는 기술 요소. GIS/DB/AI/플랫폼처럼 일반적인 단어는
// 약한 점수만 주고, 맥락 키워드와 결합될 때 콤보 보너스로 강한 신호가 된다.
const TECHNICAL_SIGNALS: ScoringSignal[] = [
  { keyword: "GIS", points: 3 },
  { keyword: "DB", points: 2 },
  { keyword: "공간정보", points: 5 },
  { keyword: "지리정보시스템", points: 5 },
  { keyword: "공간데이터", points: 4 },
  { keyword: "데이터셋", points: 3 },
  { keyword: "검증", points: 2 },
  { keyword: "검증도구", points: 5 },
  { keyword: "시뮬레이션", points: 5 },
  { keyword: "디지털트윈", points: 5 },
  { keyword: "VTS", points: 4 },
  { keyword: "디지털 VTS", points: 8 },
  { keyword: "e-Navigation", points: 5 },
  { keyword: "이내비게이션", points: 5 },
  { keyword: "SECOM", points: 5 },
  { keyword: "MCP", points: 3 },
  { keyword: "MRN", points: 3 },
  { keyword: "플랫폼", points: 2 },
  { keyword: "AI", points: 2 },
  { keyword: "인공지능", points: 2 },
  { keyword: "API", points: 2 },
  { keyword: "관제", points: 3 },
  { keyword: "모니터링", points: 2 },
  { keyword: "시각화", points: 2 },
  { keyword: "가시화", points: 2 },
  { keyword: "WMS", points: 3 },
  { keyword: "WFS", points: 3 },
  { keyword: "OGC", points: 3 },
  { keyword: "OpenLayers", points: 3 },
  { keyword: "Cesium", points: 3 },
  { keyword: "ECDIS", points: 6 },
  { keyword: "ECS", points: 5 }
];

// 개발/구축/고도화/연구/컨설팅/유지관리 등 사업 유형 신호.
// '구축', '용역'처럼 흔한 단어는 단독으로 강한 후보를 만들지 않도록 낮게 둔다.
const BUSINESS_TYPE_SIGNALS: ScoringSignal[] = [
  { keyword: "개발", points: 5 },
  { keyword: "구축", points: 4 },
  { keyword: "구현", points: 4 },
  { keyword: "고도화", points: 4 },
  { keyword: "연구", points: 4 },
  { keyword: "실증", points: 4 },
  { keyword: "컨설팅", points: 4 },
  { keyword: "용역", points: 3 },
  { keyword: "유지관리", points: 3 },
  { keyword: "운영지원", points: 3 },
  { keyword: "설계", points: 3 },
  { keyword: "소프트웨어사업자", points: 5 },
  { keyword: "SW", points: 2 }
];

// 해양/수로 관련 공공기관 신호. 발주기관명이 rawKeywordsText에 포함되어 있을 때 매칭된다.
const AGENCY_SIGNALS: ScoringSignal[] = [
  { keyword: "해양수산부", points: 6 },
  { keyword: "국립해양조사원", points: 8 },
  { keyword: "해양경찰청", points: 6 },
  { keyword: "해양경찰", points: 5 },
  { keyword: "항만공사", points: 5 },
  { keyword: "지방해양수산청", points: 5 },
  { keyword: "수로국", points: 5 },
  { keyword: "KHOA", points: 6 },
  { keyword: "IMO", points: 4 },
  { keyword: "해양환경공단", points: 4 },
  { keyword: "한국해양과학기술원", points: 4 },
  { keyword: "해양교통안전공단", points: 5 },
  { keyword: "선박해양플랜트연구소", points: 4 }
];

// 장비/모델명/단순구매/전력설비 등 블루맵 사업과 무관한 잡음 신호.
const NOISE_SIGNALS: ScoringSignal[] = [
  { keyword: "변전소", points: 6 },
  { keyword: "가스절연", points: 6 },
  { keyword: "개폐장치", points: 6 },
  { keyword: "154kv", points: 6 },
  { keyword: "GIS설비", points: 6 },
  { keyword: "정비공사", points: 4 },
  { keyword: "보수공사", points: 4 },
  { keyword: "복구공사", points: 4 },
  { keyword: "시설정비", points: 4 },
  { keyword: "케이블", points: 3 },
  { keyword: "부품", points: 3 },
  { keyword: "조립체", points: 3 },
  { keyword: "장비", points: 2 },
  { keyword: "점검", points: 2 },
  { keyword: "유지보수", points: 2 },
  { keyword: "장비구매", points: 4 },
  { keyword: "물품구매", points: 4 },
  { keyword: "물품 구매", points: 4 },
  { keyword: "구매", points: 3 },
  { keyword: "단순유지보수", points: 4 },
  { keyword: "차량", points: 2 },
  { keyword: "청소", points: 3 }
];

// 코어(들)가 매칭될 때만 보너스 대상이 되고, 맥락 키워드 풀에서 몇 개가 매칭됐는지에 따라
// 단계(tier)가 결정된다. 한 단계만 적용되므로(가장 높은 단계만 선택) 중복 가산되지 않는다.
const COMBO_FAMILIES: ComboFamily[] = [
  {
    label: "S-100 + IHO/ENC/전자해도/해도/수로제품/제품사양/데이터셋/검증",
    dimension: "standards",
    coreGroups: [["S-100", "S100", "S-101", "S-102", "S-104", "S-111", "S-122", "S-124", "S-128"]],
    contextSignals: ["IHO", "ENC", "전자해도", "해도", "수로제품", "제품사양", "데이터셋", "검증"],
    tiers: [
      { minContextMatches: 1, bonus: 30 },
      { minContextMatches: 2, bonus: 50 },
      { minContextMatches: 3, bonus: 80 }
    ]
  },
  {
    label: "GIS + 해양 + DB/공간정보/해양공간정보/S-100/해도/전자해도/구축",
    dimension: "technical",
    coreGroups: [["GIS"] , ["해양"] , ["바다"] , ["S-100"]],
    contextSignals: ["DB","공간정보", "해양공간정보", "S-100", "해도", "전자해도", "구축"],
    tiers: [
      { minContextMatches: 0, bonus: 25 },
      { minContextMatches: 1, bonus: 50 },
      { minContextMatches: 2, bonus: 75 }
    ]
  },
  {
    label: "AI + 해양데이터/항행/수로/분석/보안플랫폼/공간정보/해양공간정보/S-100/해도/전자해도/구축",
    dimension: "technical",
    coreGroups: [["AI", "인공지능"] , ["해양"] , ["바다"] , ["S-100"]],
    contextSignals: ["해양데이터", "항행", "수로", "분석", "보안플랫폼","공간정보", "해양공간정보", "S-100", "해도", "전자해도", "구축"],
    tiers: [
      { minContextMatches: 1, bonus: 20 },
      { minContextMatches: 2, bonus: 35 }
    ]
  },
  {
    label: "VTS + 해양 + 디지털/국제표준/서비스/개발",
    dimension: "technical",
    coreGroups: [["VTS"], ["해양"], ["디지털"]],
    contextSignals: ["국제표준", "서비스", "개발"],
    tiers: [
      { minContextMatches: 0, bonus: 30 },
      { minContextMatches: 1, bonus: 50 },
      { minContextMatches: 2, bonus: 78 }
    ]
  },
  {
    label: "항로표지 + 스마트/연계기술/개발/관리체계",
    dimension: "domain",
    coreGroups: [["항로표지"], ["스마트"]],
    contextSignals: ["연계기술", "개발", "관리체계"],
    tiers: [
      { minContextMatches: 0, bonus: 30 },
      { minContextMatches: 1, bonus: 60 },
      { minContextMatches: 2, bonus: 78 }
    ]
  }
];

// "GIS"는 지리정보시스템 약어지만 "GIST"(광주과학기술원)처럼 영문 약어 내부에
// 부분 문자열로도 등장하고, 전력설비 분야의 "가스절연개폐장치(Gas Insulated Switchgear)"도
// 동일하게 "GIS"로 줄여 쓴다. 단순 includes는 이 두 가지를 모두 공간정보 신호로 오인식하므로
// 토큰 경계 검사와 전력설비 맥락 키워드 배제를 함께 적용한다.
const GIS_ELECTRICAL_NOISE_KEYWORDS = [
  "gis설비",
  "가스절연",
  "개폐장치",
  "변전소",
  "kv",
  "KV",
  "개폐소",
  "변압기",
  "차단기",
  "송전",
  "배전"
];

// 장비/모델 코드(SPS-1000, GPS-100, IVS-1000 등)는 "S-100"과 같은 표준 코드와
// 표기상 매우 비슷해 단순 substring 매칭에서는 false positive를 일으킨다.
// 토큰 경계 매칭과 별개로, 이런 코드를 적극적으로 탐지해 노이즈 신호로 분리한다.
const EQUIPMENT_MODEL_CODE_PATTERN = /(?<![a-z0-9])[a-z]{2,6}-\d{2,5}[a-z0-9]*(?![a-z0-9])/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiToken(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/i.test(value);
}

function matchesStandaloneToken(normalizedText: string, normalizedToken: string): boolean {
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(normalizedToken)}(?![a-z0-9])`, "i");
  return pattern.test(normalizedText);
}

function isGisElectricalNoise(normalizedText: string): boolean {
  return GIS_ELECTRICAL_NOISE_KEYWORDS.some((noise) => normalizedText.includes(noise));
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalizeSearchText(text);
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (isAsciiToken(normalizedKeyword)) {
    if (!matchesStandaloneToken(normalizedText, normalizedKeyword)) {
      return false;
    }

    if (normalizedKeyword === "gis" && isGisElectricalNoise(normalizedText)) {
      return false;
    }

    return true;
  }

  return normalizedText.includes(normalizedKeyword);
}

export function matchKeywords(text: string, keywords: string[] = BLUEMAP_KEYWORDS): string[] {
  return keywords.filter((keyword) => matchesKeyword(text, keyword));
}

function matchScoringSignals(
  normalizedText: string,
  signals: ScoringSignal[],
  dimension: ScoringDimension
): MatchedScoringSignal[] {
  return signals
    .filter((signal) => matchesKeyword(normalizedText, signal.keyword))
    .map((signal) => ({ ...signal, dimension }));
}

function sumSignalPoints(signals: MatchedScoringSignal[]): number {
  return signals.reduce((total, signal) => total + signal.points, 0);
}

function clampScore(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function isExcludedByWinnerMethod(normalizedText: string): boolean {
  return EXCLUSION_SIGNALS.some((signal) => normalizedText.includes(normalizeSearchText(signal)));
}

function matchEquipmentModelCodeNoise(normalizedText: string): string[] {
  const matches = normalizedText.match(EQUIPMENT_MODEL_CODE_PATTERN) ?? [];
  const standardsAllowlist = new Set(STANDARDS_SIGNALS.map((signal) => normalizeSearchText(signal.keyword)));

  return uniqueValues(matches.filter((match) => !standardsAllowlist.has(match)));
}

function evaluateComboFamilies(normalizedText: string): AppliedCombo[] {
  return COMBO_FAMILIES.flatMap((family): AppliedCombo[] => {
    const coreMatched = family.coreGroups.every((group) =>
      group.some((keyword) => matchesKeyword(normalizedText, keyword))
    );

    if (!coreMatched) {
      return [];
    }

    const matchedContextSignals = family.contextSignals.filter((keyword) =>
      matchesKeyword(normalizedText, keyword)
    );
    const bestTier = family.tiers
      .filter((tier) => matchedContextSignals.length >= tier.minContextMatches)
      .sort((a, b) => b.bonus - a.bonus)[0];

    if (!bestTier || bestTier.bonus <= 0) {
      return [];
    }

    return [
      {
        label: `${family.label} (맥락 ${matchedContextSignals.length}건 일치, +${bestTier.bonus}점)`,
        dimension: family.dimension,
        bonus: bestTier.bonus,
        matchedContextSignals
      }
    ];
  });
}

export function scoreNoticeText(text: string, keywords: string[] = BLUEMAP_KEYWORDS): ScoreResult {
  const normalizedText = normalizeSearchText(text);
  const operatorKeywordMatches = matchKeywords(text, keywords);

  const excluded = isExcludedByWinnerMethod(normalizedText);

  const domainMatches = matchScoringSignals(normalizedText, DOMAIN_SIGNALS, "domain");
  const standardsMatches = matchScoringSignals(normalizedText, STANDARDS_SIGNALS, "standards");
  const technicalMatches = matchScoringSignals(normalizedText, TECHNICAL_SIGNALS, "technical");
  const businessTypeMatches = matchScoringSignals(normalizedText, BUSINESS_TYPE_SIGNALS, "businessType");
  const agencyMatches = matchScoringSignals(normalizedText, AGENCY_SIGNALS, "agency");
  const noiseKeywordMatches = matchScoringSignals(normalizedText, NOISE_SIGNALS, "noise");
  const equipmentNoiseCodes = matchEquipmentModelCodeNoise(normalizedText);

  const appliedCombos = evaluateComboFamilies(normalizedText);
  const comboBonusByDimension: Record<ComboDimension, number> = {
    domain: 0,
    standards: 0,
    technical: 0
  };
  for (const combo of appliedCombos) {
    comboBonusByDimension[combo.dimension] += combo.bonus;
  }
  const combinationBonus = appliedCombos.reduce((total, combo) => total + combo.bonus, 0);

  const domainScore = clampScore(sumSignalPoints(domainMatches), MAX_DOMAIN_SCORE) + comboBonusByDimension.domain;
  const standardsScore =
    clampScore(sumSignalPoints(standardsMatches), MAX_STANDARDS_SCORE) + comboBonusByDimension.standards;
  const technicalScore =
    clampScore(sumSignalPoints(technicalMatches), MAX_TECHNICAL_SCORE) + comboBonusByDimension.technical;
  const businessTypeScore = clampScore(sumSignalPoints(businessTypeMatches), MAX_BUSINESS_TYPE_SCORE);
  const agencyScore = clampScore(sumSignalPoints(agencyMatches), MAX_AGENCY_SCORE);
  const noisePenalty = clampScore(
    sumSignalPoints(noiseKeywordMatches) + equipmentNoiseCodes.length * 4,
    MAX_NOISE_PENALTY
  );

  const rawScore = domainScore + standardsScore + technicalScore + businessTypeScore + agencyScore - noisePenalty;
  const score = excluded ? 0 : clampScore(rawScore, 100);

  const breakdown: ScoreBreakdown = {
    domainScore,
    standardsScore,
    technicalScore,
    businessTypeScore,
    agencyScore,
    noisePenalty,
    combinationBonus,
    matchedDomainSignals: uniqueValues(domainMatches.map((signal) => signal.keyword)),
    matchedStandardsSignals: uniqueValues(standardsMatches.map((signal) => signal.keyword)),
    matchedTechnicalSignals: uniqueValues(technicalMatches.map((signal) => signal.keyword)),
    matchedBusinessTypeSignals: uniqueValues(businessTypeMatches.map((signal) => signal.keyword)),
    matchedAgencySignals: uniqueValues(agencyMatches.map((signal) => signal.keyword)),
    matchedNoiseSignals: uniqueValues([
      ...noiseKeywordMatches.map((signal) => signal.keyword),
      ...equipmentNoiseCodes
    ]),
    appliedCombinationBonuses: appliedCombos.map((combo) => combo.label),
    matchedSignals: uniqueValues([
      ...domainMatches,
      ...standardsMatches,
      ...technicalMatches,
      ...businessTypeMatches,
      ...agencyMatches,
      ...noiseKeywordMatches
    ].map((signal) => signal.keyword)),
    excluded,
    exclusionReason: excluded ? "수의시담/다자간수의시담 공고로 계약대상자 외 참여가 불가능합니다." : undefined
  };

  const matchedKeywords = uniqueValues([
    ...operatorKeywordMatches,
    ...breakdown.matchedSignals,
    ...equipmentNoiseCodes
  ]);
  const reason = buildScoreReason(breakdown, operatorKeywordMatches);

  return {
    score,
    matchedKeywords,
    reason,
    breakdown
  };
}

export function applyScore(
  notice: Omit<NormalizedNotice, "matchedKeywords" | "score" | "scoreReason">,
  keywords: string[] = BLUEMAP_KEYWORDS
): NormalizedNotice {
  const result = scoreNoticeText(notice.rawKeywordsText, keywords);

  return {
    ...notice,
    matchedKeywords: result.matchedKeywords,
    score: result.score,
    scoreReason: result.reason
  };
}

export function rescoreNotice(notice: NormalizedNotice, keywords: string[] = BLUEMAP_KEYWORDS): NormalizedNotice {
  const { matchedKeywords, score, scoreReason, ...scoreableNotice } = notice;

  return applyScore(scoreableNotice, keywords);
}

function buildScoreReason(breakdown: ScoreBreakdown, operatorKeywordMatches: string[]): string {
  if (breakdown.excluded) {
    return breakdown.exclusionReason ?? "계약대상자 외 참여가 불가능한 공고로 제외되었습니다.";
  }

  if (breakdown.matchedSignals.length === 0 && breakdown.combinationBonus === 0) {
    if (operatorKeywordMatches.length > 0) {
      return `후보 키워드(${operatorKeywordMatches.slice(0, 6).join(", ")})는 매칭됐지만 도메인/표준/기술/사업유형/발주기관 신호가 확인되지 않았습니다.`;
    }

    return "블루맵 적합도 산정 신호가 확인되지 않았습니다.";
  }

  const signalSummary = [
    formatSignalGroup("도메인", breakdown.domainScore, breakdown.matchedDomainSignals),
    formatSignalGroup("표준", breakdown.standardsScore, breakdown.matchedStandardsSignals),
    formatSignalGroup("기술", breakdown.technicalScore, breakdown.matchedTechnicalSignals),
    formatSignalGroup("사업유형", breakdown.businessTypeScore, breakdown.matchedBusinessTypeSignals),
    formatSignalGroup("발주기관", breakdown.agencyScore, breakdown.matchedAgencySignals),
    breakdown.noisePenalty > 0 ? formatSignalGroup("노이즈", -breakdown.noisePenalty, breakdown.matchedNoiseSignals) : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  const comboSummary =
    breakdown.appliedCombinationBonuses.length > 0
      ? ` 결합 보너스(${breakdown.appliedCombinationBonuses.join(" / ")})가 적용되었습니다.`
      : "";

  return `${signalSummary} 기준으로 산정했습니다.${comboSummary}`;
}

function formatSignalGroup(label: string, score: number, matches: string[]): string | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  return `${label} ${score}점(${matches.slice(0, 4).join(", ")})`;
}
