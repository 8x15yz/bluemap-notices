import { BLUEMAP_KEYWORDS } from "@/lib/config/keywords";
import type { NormalizedNotice } from "@/lib/types";

const MAX_CAPABILITY_SCORE = 40;
const MAX_GENERAL_TECH_SCORE = 25;
const MAX_CONTEXT_SCORE = 20;
const MAX_RISK_PENALTY = 15;

type ScoringCategory = "capability" | "generalTech" | "context" | "risk";

interface ScoringSignal {
  keyword: string;
  points: number;
}

interface MatchedScoringSignal extends ScoringSignal {
  category: ScoringCategory;
}

export interface ScoreBreakdown {
  capabilityScore: number;
  generalTechScore: number;
  contextScore: number;
  riskPenalty: number;
  matchedSignals: string[];
}

export interface ScoreResult {
  score: number;
  matchedKeywords: string[];
  reason: string;
  breakdown: ScoreBreakdown;
}

const CAPABILITY_SIGNALS: ScoringSignal[] = [
  { keyword: "S-100", points: 14 },
  { keyword: "S100", points: 14 },
  { keyword: "S-101", points: 12 },
  { keyword: "S-102", points: 12 },
  { keyword: "S-104", points: 12 },
  { keyword: "S-111", points: 12 },
  { keyword: "S-124", points: 12 },
  { keyword: "전자해도", points: 12 },
  { keyword: "ENC", points: 10 },
  { keyword: "수로제품", points: 10 },
  { keyword: "IHO", points: 8 },
  { keyword: "해양공간정보", points: 12 },
  { keyword: "VTS", points: 14 },
  { keyword: "디지털 VTS", points: 14 },
  { keyword: "S-210", points: 12 },
  { keyword: "IVEF", points: 10 },
  { keyword: "S-212", points: 10 },
  { keyword: "해상교통", points: 8 },
  { keyword: "해사정보", points: 8 },
  { keyword: "항로표지", points: 12 },
  { keyword: "IALA", points: 12 },
  { keyword: "S-200", points: 10 },
  { keyword: "S-201", points: 10 },
  { keyword: "AtoN", points: 8 },
  { keyword: "항행안전시설", points: 8 },
  { keyword: "ECDIS", points: 12 },
  { keyword: "ECS", points: 10 },
  { keyword: "항해장비", points: 8 },
  { keyword: "적합성 평가", points: 8 },
  { keyword: "e-Navigation", points: 10 },
  { keyword: "이내비게이션", points: 10 },
  { keyword: "SECOM", points: 10 },
  { keyword: "MCP", points: 6 },
  { keyword: "MRN", points: 6 },
  { keyword: "해양데이터", points: 10 },
  { keyword: "조위", points: 6 },
  { keyword: "조류", points: 6 },
  { keyword: "해류", points: 6 },
  { keyword: "스마트항만", points: 8 },
  { keyword: "자율운항", points: 8 },
  { keyword: "국제표준", points: 6 }
];

const GENERAL_TECH_SIGNALS: ScoringSignal[] = [
  { keyword: "GIS", points: 8 },
  { keyword: "공간정보", points: 7 },
  { keyword: "지리정보시스템", points: 7 },
  { keyword: "공간데이터", points: 6 },
  { keyword: "API", points: 5 },
  { keyword: "DB", points: 5 },
  { keyword: "데이터 모델링", points: 6 },
  { keyword: "데이터 표준화", points: 6 },
  { keyword: "WMS", points: 5 },
  { keyword: "WFS", points: 5 },
  { keyword: "OGC", points: 5 },
  { keyword: "ISO", points: 4 },
  { keyword: "OpenLayers", points: 5 },
  { keyword: "Cesium", points: 5 },
  { keyword: "모니터링", points: 5 },
  { keyword: "관제", points: 6 },
  { keyword: "시각화", points: 5 },
  { keyword: "가시화", points: 5 },
  { keyword: "디지털트윈", points: 6 },
  { keyword: "정보시스템", points: 4 },
  { keyword: "플랫폼", points: 4 },
  { keyword: "클라우드", points: 3 },
  { keyword: "빅데이터", points: 3 },
  { keyword: "시스템", points: 3 }
];

const CONTEXT_SIGNALS: ScoringSignal[] = [
  { keyword: "용역", points: 5 },
  { keyword: "개발", points: 8 },
  { keyword: "구축", points: 7 },
  { keyword: "고도화", points: 7 },
  { keyword: "유지관리", points: 6 },
  { keyword: "운영지원", points: 6 },
  { keyword: "연구", points: 7 },
  { keyword: "실증", points: 7 },
  { keyword: "설계", points: 5 },
  { keyword: "소프트웨어사업자", points: 8 },
  { keyword: "SW", points: 6 },
  { keyword: "정보화", points: 5 },
  { keyword: "제안요청서", points: 4 },
  { keyword: "협상에의한계약", points: 4 },
  { keyword: "협상에 의한 계약", points: 4 },
  { keyword: "일반용역", points: 4 }
];

const RISK_SIGNALS: ScoringSignal[] = [
  { keyword: "건축공사", points: 10 },
  { keyword: "토목", points: 9 },
  { keyword: "토목공사", points: 10 },
  { keyword: "전기공사", points: 9 },
  { keyword: "설비 정비", points: 8 },
  { keyword: "시설정비", points: 8 },
  { keyword: "정비공사", points: 8 },
  { keyword: "복구공사", points: 8 },
  { keyword: "보수공사", points: 8 },
  { keyword: "배수", points: 6 },
  { keyword: "배관", points: 6 },
  { keyword: "구매", points: 8 },
  { keyword: "물품", points: 5 },
  { keyword: "물품 구매", points: 8 },
  { keyword: "차량", points: 5 },
  { keyword: "청소", points: 8 },
  { keyword: "공사", points: 3 }
];

// "GIS"는 지리정보시스템 약어지만 "GIST"(광주과학기술원)처럼 영문 약어 내부에
// 부분 문자열로도 등장하고, 전력설비 분야의 "가스절연개폐장치(Gas Insulated Switchgear)"도
// 동일하게 "GIS"로 줄여 쓴다. 단순 includes는 이 두 가지를 모두 공간정보 신호로 오인식하므로
// 토큰 경계 검사와 전력설비 맥락 키워드 배제를 함께 적용한다.
const GIS_ELECTRICAL_NOISE_KEYWORDS = ["gis설비", "가스절연", "개폐장치", "변전소", "154kv"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (normalizedKeyword === "gis") {
    return matchesStandaloneToken(normalizedText, normalizedKeyword) && !isGisElectricalNoise(normalizedText);
  }

  return normalizedText.includes(normalizedKeyword);
}

export function matchKeywords(text: string, keywords: string[] = BLUEMAP_KEYWORDS): string[] {
  return keywords.filter((keyword) => matchesKeyword(text, keyword));
}

export function scoreNoticeText(text: string, keywords: string[] = BLUEMAP_KEYWORDS): ScoreResult {
  const normalizedText = normalizeSearchText(text);
  const operatorKeywordMatches = matchKeywords(text, keywords);
  const capabilityMatches = matchScoringSignals(normalizedText, CAPABILITY_SIGNALS, "capability");
  const generalTechMatches = matchScoringSignals(normalizedText, GENERAL_TECH_SIGNALS, "generalTech");
  const contextMatches = matchScoringSignals(normalizedText, CONTEXT_SIGNALS, "context");
  const riskMatches = matchScoringSignals(normalizedText, RISK_SIGNALS, "risk");
  const breakdown: ScoreBreakdown = {
    capabilityScore: clampScore(sumSignalPoints(capabilityMatches), MAX_CAPABILITY_SCORE),
    generalTechScore: clampScore(sumSignalPoints(generalTechMatches), MAX_GENERAL_TECH_SCORE),
    contextScore: clampScore(sumSignalPoints(contextMatches), MAX_CONTEXT_SCORE),
    riskPenalty: clampScore(sumSignalPoints(riskMatches), MAX_RISK_PENALTY),
    matchedSignals: uniqueValues([
      ...capabilityMatches,
      ...generalTechMatches,
      ...contextMatches,
      ...riskMatches
    ].map((signal) => signal.keyword))
  };
  const score = clampScore(
    breakdown.capabilityScore + breakdown.generalTechScore + breakdown.contextScore - breakdown.riskPenalty,
    100
  );
  const matchedKeywords = uniqueValues([...operatorKeywordMatches, ...breakdown.matchedSignals]);
  const reason = buildScoreReason({
    breakdown,
    capabilityMatches,
    generalTechMatches,
    contextMatches,
    riskMatches,
    operatorKeywordMatches
  });

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

function matchScoringSignals(
  normalizedText: string,
  signals: ScoringSignal[],
  category: ScoringCategory
): MatchedScoringSignal[] {
  return signals
    .filter((signal) => matchesKeyword(normalizedText, signal.keyword))
    .map((signal) => ({
      ...signal,
      category
    }));
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

function buildScoreReason(params: {
  breakdown: ScoreBreakdown;
  capabilityMatches: MatchedScoringSignal[];
  generalTechMatches: MatchedScoringSignal[];
  contextMatches: MatchedScoringSignal[];
  riskMatches: MatchedScoringSignal[];
  operatorKeywordMatches: string[];
}): string {
  const { breakdown, capabilityMatches, generalTechMatches, contextMatches, riskMatches, operatorKeywordMatches } = params;

  if (breakdown.matchedSignals.length === 0) {
    if (operatorKeywordMatches.length > 0) {
      return `후보 키워드(${operatorKeywordMatches.slice(0, 6).join(", ")})는 매칭됐지만 블루맵 핵심역량, 일반 IT/GIS, 과업 맥락 신호가 제한적입니다.`;
    }

    return "블루맵 적합도 산정 신호가 확인되지 않았습니다.";
  }

  const signalSummary = [
    formatSignalGroup("핵심역량", breakdown.capabilityScore, capabilityMatches),
    formatSignalGroup("일반기술", breakdown.generalTechScore, generalTechMatches),
    formatSignalGroup("과업맥락", breakdown.contextScore, contextMatches),
    formatSignalGroup("리스크", -breakdown.riskPenalty, riskMatches)
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  return `${signalSummary} 기준으로 적합도 ${breakdown.capabilityScore + breakdown.generalTechScore + breakdown.contextScore}점에서 리스크 ${breakdown.riskPenalty}점을 반영했습니다.`;
}

function formatSignalGroup(label: string, score: number, matches: MatchedScoringSignal[]): string | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  const scoreLabel = score < 0 ? `${score}점` : `${score}점`;
  return `${label} ${scoreLabel}(${matches.slice(0, 4).map((signal) => signal.keyword).join(", ")})`;
}
