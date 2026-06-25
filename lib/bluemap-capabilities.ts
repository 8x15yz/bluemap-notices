import { matchesKeyword } from "@/lib/scoring";
import type { NoticeRecord } from "@/lib/types";

export interface BluemapCapability {
  id: string;
  title: string;
  keywords: string[];
  strengths: string[];
  proposalAngles: string[];
  evidence: string[];
}

export interface MatchedBluemapCapability extends BluemapCapability {
  matchedKeywords: string[];
  relevanceScore: number;
}

type NoticeCapabilityInput = Pick<
  NoticeRecord,
  "title" | "organization" | "summary" | "rawKeywordsText" | "matchedKeywords" | "scoreReason" | "metadata"
>;

export const BLUEMAP_CAPABILITIES: BluemapCapability[] = [
  {
    id: "s100-hydro-products",
    title: "S-100 국제표준 기반 차세대 수로제품 기술",
    keywords: ["S-100", "S100", "S-101", "S-102", "S-104", "S-111", "S-124", "전자해도", "ENC", "수로제품", "IHO", "GML", "S-63"],
    strengths: [
      "S-101, S-102, S-104, S-111, S-124 등 S-100 계열 데이터 제품과 검증 도구를 다룬 경험",
      "Feature Catalogue, Portrayal Catalogue, Schema Validator, GML Encoder 등 표준 기반 제작/검증 흐름 이해",
      "S-100 Part 15, S-63 등 보안/유통 체계까지 고려한 수로 데이터 구현 역량"
    ],
    proposalAngles: [
      "표준 데이터 모델과 검증 절차를 제안 범위에 명확히 포함한다.",
      "수로 데이터 제작, 변환, 품질검사, 배포까지 이어지는 운영 흐름을 제시한다."
    ],
    evidence: ["IHO S-100 WG 참여", "OpenS-100 기반 도구 개발", "S-100 계열 제품군 적용 경험"]
  },
  {
    id: "enavigation-secom",
    title: "e-Navigation 및 SECOM 기반 해상통신 기술",
    keywords: ["e-Navigation", "이내비게이션", "eNav", "SECOM", "MCP", "MRN", "PKI", "인증서", "암호화", "전자서명", "해상통신"],
    strengths: [
      "SECOM 프로토콜 기반 Upload/Get/Subscription 서비스 흐름 구현 경험",
      "PKI, 인증서, 암호화, 전자서명 등 해사 데이터 교환 보안 구조 이해",
      "MCP/MRN 기반 식별 체계와 서비스 레지스트리 연계 경험"
    ],
    proposalAngles: [
      "해상 서비스 연계는 통신 프로토콜, 인증, 데이터 교환 절차를 분리해 제안한다.",
      "운영기관이 서비스 등록과 연계를 반복할 수 있는 구조를 강조한다."
    ],
    evidence: ["SECOM 프로토콜 오픈소스화 경험", "SFR-10/11/12 서비스 구현", "MCP/MRN 연계 경험"]
  },
  {
    id: "marine-gis",
    title: "GIS 기반 해양공간정보 서비스 기술",
    keywords: ["GIS", "공간정보", "해양공간정보", "지리정보시스템", "공간데이터", "WMS", "WFS", "OGC", "ISO", "OpenLayers", "Cesium", "3D Tiles", "디지털트윈"],
    strengths: [
      "S-57/S-100, OGC/ISO, CityGML 등 해양·공간 표준 데이터 처리 경험",
      "OpenLayers, Cesium, 3D Tiles 기반 2D/3D 해양공간정보 가시화 역량",
      "HDF5, GML, ISO8211 등 다양한 포맷의 변환·연계·검증 경험"
    ],
    proposalAngles: [
      "데이터 표준화, 지도 가시화, 운영자 화면, API 연계를 하나의 서비스 흐름으로 제안한다.",
      "해양 도메인 데이터 특성을 반영한 공간정보 품질관리와 확장성을 강조한다."
    ],
    evidence: ["해양공간정보 GIS 서비스 구축 경험", "2D/3D 지도 가시화 경험", "표준 포맷 변환·연계 경험"]
  },
  {
    id: "ecdis-ecs",
    title: "ECDIS·ECS급 항해장비 연계 및 적합성 평가 기술",
    keywords: ["ECDIS", "ECS", "항해장비", "항해 시스템", "S-98", "S-164", "S-64", "적합성 평가", "conformance", "TCP/IP"],
    strengths: [
      "ECS/ECDIS급 항해장비와 데이터 연계 흐름을 이해한 구현 경험",
      "S-98, S-164, S-64 등 항해장비 검증 기준과 테스트 데이터 활용 경험",
      "TCP/IP 기반 장비·시스템 인터페이스 설계 역량"
    ],
    proposalAngles: [
      "장비 연계와 검증 기준을 요구사항 추적표에 연결한다.",
      "테스트 데이터와 적합성 평가 절차를 산출물·검수 계획에 반영한다."
    ],
    evidence: ["항해장비 연계 SW 경험", "S-98/S-164/S-64 기반 검증 경험", "적합성 평가 시스템 설계 경험"]
  },
  {
    id: "military-s500",
    title: "군 분야 표준 데이터 제작 및 분석활용 시스템 기술",
    keywords: ["S-500", "S-412", "군", "국방", "해군", "레이더", "수중", "군용", "전술", "AIS", "NMEA", "오프라인 단말"],
    strengths: [
      "S-500 계열 표준 데이터 제작, 품질검증, 분석활용 시스템 경험",
      "레이더, 항해, 수중 데이터의 분석·가시화와 로컬 DB/오프라인 단말 운용 경험",
      "GPS, AIS, NMEA 등 현장 신호와 해양 데이터 연계 이해"
    ],
    proposalAngles: [
      "보안·망분리·오프라인 운용 조건을 초기 설계 제약으로 다룬다.",
      "표준 데이터 제작과 분석활용 화면을 별도 산출물로 제시한다."
    ],
    evidence: ["S-500 프로세스 경험", "S-412/GML 데이터셋 경험", "군 분야 분석활용 시스템 경험"]
  },
  {
    id: "s200-iala",
    title: "항로표지 정보 시스템 및 IALA S-200 표준 기술",
    keywords: ["S-200", "S-201", "IALA", "항로표지", "등대", "부표", "AtoN", "DCEG", "ARM", "MRN", "항행안전시설"],
    strengths: [
      "IALA S-200 계열 스키마, 카탈로그, DCEG, GML 데이터 구조 이해",
      "S-201 항로표지 표준 개정과 데이터 모델링 경험",
      "항로표지 DB, MRN, API 기반 운영 시스템 설계 역량"
    ],
    proposalAngles: [
      "항로표지 자산 DB와 표준 데이터셋을 함께 관리하는 구조를 제안한다.",
      "국제표준 기반 확장성과 기관 간 데이터 교환 가능성을 강조한다."
    ],
    evidence: ["IALA ARM WG2 S-201 리더 경험", "S-201 v1.1.0 기여", "항로표지 DB/API 경험"]
  },
  {
    id: "digital-vts",
    title: "디지털 VTS 및 차세대 해사정보서비스 기술",
    keywords: ["VTS", "관제", "해상교통", "디지털 VTS", "S-210", "IVEF", "S-212", "해사정보", "모니터링", "관제시스템"],
    strengths: [
      "디지털 VTS 서비스와 사용자 단말 SW 구축 경험",
      "S-210 IVEF, S-212 등 VTS 데이터 교환 표준 이해",
      "해상교통 관제·모니터링 화면과 데이터 연계 설계 역량"
    ],
    proposalAngles: [
      "관제 업무 흐름, 실시간 데이터 연계, 사용자 화면을 함께 제안한다.",
      "표준 기반 VTS 데이터 교환과 향후 서비스 확장성을 강조한다."
    ],
    evidence: ["Digital VTS 프로젝트 경험", "VTS 사용자 단말 SW 경험", "S-210/S-212 표준 활용 경험"]
  },
  {
    id: "ocean-data-visualization",
    title: "해양데이터 활용 및 실시간 가시화 기술",
    keywords: ["해양데이터", "조위", "조류", "해류", "풍향", "풍속", "실시간", "가시화", "시각화", "연속장", "3D", "품질 알고리즘"],
    strengths: [
      "조위, 조류, 해류, 바람 등 해양 환경 데이터의 실시간 가시화 경험",
      "KHOA 3D 디지털트윈과 해양 연속장 데이터 모델 이해",
      "해양 데이터 품질 알고리즘과 메타데이터 모델 설계 경험"
    ],
    proposalAngles: [
      "실시간 데이터 수집, 품질검사, 시각화, 알림 흐름을 단계별로 제안한다.",
      "운영자가 데이터 상태를 빠르게 판단할 수 있는 화면과 품질 지표를 강조한다."
    ],
    evidence: ["해양 환경 데이터 가시화 경험", "KHOA 3D 디지털트윈 경험", "S-100 메타데이터 모델 경험"]
  },
  {
    id: "maintenance-integration",
    title: "기존 시스템 유지관리 및 안정적 통합 개발 역량",
    keywords: ["유지관리", "운영지원", "고도화", "통합", "연계", "장애 대응", "성능 개선", "보안 업데이트", "마이그레이션", "기존 시스템"],
    strengths: [
      "기존 해양 정보시스템 운영·유지관리와 장애 대응 경험",
      "운영 중인 시스템의 성능 개선, 보안 업데이트, 기능 고도화 경험",
      "현행 시스템을 유지하면서 신규 기능과 데이터를 단계적으로 통합하는 역량"
    ],
    proposalAngles: [
      "현행 운영 안정성을 해치지 않는 단계적 전환 계획을 제시한다.",
      "장애 대응, 성능 개선, 운영 인수인계 절차를 수행 전략에 포함한다."
    ],
    evidence: ["imENC/eNavSys 유지관리 경험", "운영 시스템 고도화 경험", "장애 대응·보안 업데이트 경험"]
  },
  {
    id: "security-quality",
    title: "보안·품질관리 및 사업 수행 역량",
    keywords: ["보안", "품질관리", "검수", "암호", "로그", "SHA-256", "ISO/IEC 25023", "IEEE 1016", "산출물", "품질"],
    strengths: [
      "암호화, 로그, 해시 등 보안 요소를 포함한 시스템 설계 경험",
      "ISO/IEC 25023, IEEE 1016 등 품질·설계 문서 기준을 고려한 산출물 관리 역량",
      "반복 검토와 검증을 전제로 한 프로젝트 관리·품질관리 경험"
    ],
    proposalAngles: [
      "보안 요구와 품질검수 기준을 요구사항 추적표와 산출물 계획에 연결한다.",
      "착수·중간·완료 단계별 검증 체계를 운영 리스크 절감 포인트로 제시한다."
    ],
    evidence: ["보안 설계 요소 적용 경험", "품질관리 산출물 경험", "반복 검증 기반 사업 수행 경험"]
  }
];

export function matchBluemapCapabilities(text: string, limit = BLUEMAP_CAPABILITIES.length): MatchedBluemapCapability[] {
  const normalizedText = normalizeSearchText(text);

  return BLUEMAP_CAPABILITIES.map((capability, index) => {
    const matchedKeywords = capability.keywords.filter((keyword) => matchesKeyword(normalizedText, keyword));
    const relevanceScore = matchedKeywords.reduce((score, keyword) => score + getKeywordWeight(keyword), 0);

    return {
      ...capability,
      matchedKeywords,
      relevanceScore,
      order: index
    };
  })
    .filter((capability) => capability.matchedKeywords.length > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.order - b.order)
    .slice(0, limit)
    .map(({ order: _order, ...capability }) => capability);
}

export function buildNoticeCapabilitySearchText(notice: NoticeCapabilityInput, documentMarkdown = ""): string {
  return [
    notice.title,
    notice.organization,
    notice.summary,
    notice.rawKeywordsText,
    notice.scoreReason,
    notice.matchedKeywords.join(" "),
    stringifyMetadata(notice.metadata),
    documentMarkdown
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("\n");
}

export function buildBluemapCapabilityPromptContext(notice: NoticeCapabilityInput, documentMarkdown: string, limit = 5): string {
  const matches = matchBluemapCapabilities(buildNoticeCapabilitySearchText(notice, documentMarkdown), limit);

  if (matches.length === 0) {
    return "- 공고/첨부문서에서 직접 매칭된 블루맵 기술특장점이 없습니다. 블루맵 적합성은 문서에서 확인되는 근거 안에서 보수적으로 작성합니다.";
  }

  return matches
    .map((capability, index) =>
      [
        `### ${index + 1}. ${capability.title}`,
        `- 매칭 신호: ${capability.matchedKeywords.slice(0, 8).join(", ")}`,
        `- 블루맵 근거: ${capability.strengths.join(" / ")}`,
        `- 제안 전략 포인트: ${capability.proposalAngles.join(" / ")}`,
        `- 레퍼런스 단서: ${capability.evidence.join(" / ")}`
      ].join("\n")
    )
    .join("\n\n");
}

export function buildBluemapRecommendationReason(notice: NoticeCapabilityInput): string {
  const baseReason = notice.scoreReason.trim() || "공고 내용과 블루맵 역량의 연결성을 확인해야 합니다.";
  const matches = matchBluemapCapabilities(buildNoticeCapabilitySearchText(notice), 3);

  if (matches.length === 0) {
    return `${baseReason} 블루맵 기술특장점 기준으로는 직접 연결되는 신호가 제한적입니다. 첨부문서에서 해양공간정보, S-100, VTS, 항로표지, 해양데이터, 표준/API 연계 같은 구체 요구가 있는지 확인해야 합니다.`;
  }

  const titles = matches.map((capability) => capability.title).join(", ");
  const primaryStrength = matches[0].strengths[0];

  return `${baseReason} 블루맵 기술특장점 기준으로는 ${titles} 역량이 연결됩니다. 특히 ${primaryStrength}를 근거로 검토할 수 있습니다.`;
}

export function buildBluemapScoreReason(text: string, matchedKeywords: string[]): string {
  if (matchedKeywords.length === 0) {
    return "블루맵 핵심 키워드와 직접 매칭되지 않았습니다.";
  }

  const keywordReason = `${matchedKeywords.slice(0, 6).join(", ")} 키워드가 공고 내용과 맞습니다.`;
  const matches = matchBluemapCapabilities(text, 2);

  if (matches.length === 0) {
    return `${keywordReason} 다만 블루맵 기술특장점 기준의 직접 매칭은 제한적이어서 첨부문서에서 해양공간정보, 표준 데이터, API 연계 등 구체 범위를 확인해야 합니다.`;
  }

  return `${keywordReason} 블루맵 기술특장점 기준으로는 ${matches.map((capability) => capability.title).join(", ")} 역량과 연결됩니다.`;
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function getKeywordWeight(keyword: string): number {
  if (/^s-\d+/i.test(keyword) || keyword.length >= 6) {
    return 6;
  }

  if (/^[a-z0-9/-]+$/i.test(keyword)) {
    return 4;
  }

  return 3;
}

function stringifyMetadata(metadata: Record<string, unknown>): string {
  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
  }
}
