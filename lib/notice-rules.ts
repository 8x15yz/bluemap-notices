import { matchesKeyword } from "@/lib/scoring";
import type { NormalizedNotice } from "@/lib/types";

export const EXCLUDED_WINNER_METHOD = "수의시담";

export const DEFAULT_IT_RELEVANT_KEYWORDS = [
  "GIS",
  "지리정보시스템",
  "공간정보",
  "공간데이터",
  "데이터",
  "DB",
  "API",
  "정보시스템",
  "전산",
  "소프트웨어",
  "SW",
  "서버",
  "네트워크",
  "클라우드",
  "빅데이터",
  "디지털",
  "플랫폼",
  "포털",
  "시스템 구축",
  "시스템 고도화",
  "가상화",
  "시각화",
  "모니터링",
  "관제",
  "디지털트윈",
  "S-100"
];

export const DEFAULT_NON_IT_EXCLUSION_KEYWORDS = [
  "시설정비",
  "시설 정비",
  "시설공사",
  "정비공사",
  "복구공사",
  "보수공사",
  "개보수",
  "보강공사",
  "리모델링",
  "인테리어",
  "건축공사",
  "토목공사",
  "전기공사",
  "소방공사",
  "기계설비",
  "조경",
  "포장공사",
  "배수로",
  "호안",
  "준설",
  "철거",
  "폐기물",
  "청소",
  "용역근로",
  "급식",
  "식자재",
  "연료유",
  "유류",
  "소모품",
  "예비품",
  "부속",
  "부품",
  "기자재",
  "장비 구매",
  "물품 구매",
  "구매(단가)",
  "임차",
  "차량",
  "헬리콥터"
];

export interface NoticeRuleConfig {
  itRelevantKeywords: string[];
  nonItExclusionKeywords: string[];
}

export const DEFAULT_NOTICE_RULE_CONFIG: NoticeRuleConfig = {
  itRelevantKeywords: DEFAULT_IT_RELEVANT_KEYWORDS,
  nonItExclusionKeywords: DEFAULT_NON_IT_EXCLUSION_KEYWORDS
};

export function hasExcludedWinnerMethod(metadata: Record<string, unknown>): boolean {
  const winnerMethod = metadata.winnerMethod;

  return typeof winnerMethod === "string" && winnerMethod.includes(EXCLUDED_WINNER_METHOD);
}

export function hasRelevantItSignal(
  notice: Pick<NormalizedNotice, "title" | "rawKeywordsText" | "matchedKeywords" | "metadata">,
  config: NoticeRuleConfig = DEFAULT_NOTICE_RULE_CONFIG
): boolean {
  return includesAnyKeyword(buildNoticeRuleText(notice), config.itRelevantKeywords);
}

export function hasNonItExclusionSignal(
  notice: Pick<NormalizedNotice, "title" | "rawKeywordsText" | "matchedKeywords" | "metadata">,
  config: NoticeRuleConfig = DEFAULT_NOTICE_RULE_CONFIG
): boolean {
  return includesAnyKeyword(buildNoticeRuleText(notice), config.nonItExclusionKeywords);
}

export function shouldExcludeNoticeCandidate(
  notice: Pick<NormalizedNotice, "title" | "rawKeywordsText" | "matchedKeywords" | "metadata">,
  config: NoticeRuleConfig = DEFAULT_NOTICE_RULE_CONFIG
): boolean {
  if (hasExcludedWinnerMethod(notice.metadata)) {
    return true;
  }

  return hasNonItExclusionSignal(notice, config) && !hasRelevantItSignal(notice, config);
}

function buildNoticeRuleText(notice: Pick<NormalizedNotice, "title" | "rawKeywordsText" | "matchedKeywords" | "metadata">): string {
  const metadataValues = [
    notice.metadata.businessDivision,
    notice.metadata.noticeStatus,
    notice.metadata.noticeInstitution,
    notice.metadata.demandInstitution,
    notice.metadata.possibleRegions,
    notice.metadata.possibleIndustries,
    notice.metadata.contractMethod,
    notice.metadata.winnerMethod
  ];

  return [
    notice.title,
    notice.rawKeywordsText,
    ...notice.matchedKeywords,
    ...metadataValues.filter((value): value is string => typeof value === "string")
  ]
    .join(" ")
    .toLocaleLowerCase("ko-KR");
}

function includesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => matchesKeyword(text, keyword));
}
