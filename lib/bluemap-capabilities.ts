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

export interface BluemapCapability {
  id: string;
  title: string;
  fitLevel: "core" | "adjacent" | "supporting" | "noise";
  keywords: string[];
  strongFitSignals: string[];
  weakFitSignals?: string[];
  cautionSignals?: string[];
  strengths: string[];
  proposalAngles: string[];
  evidence: string[];
}

type NoticeCapabilityInput = Pick<
  NoticeRecord,
  "title" | "organization" | "summary" | "rawKeywordsText" | "matchedKeywords" | "scoreReason" | "metadata"
>;

export const BLUEMAP_CAPABILITIES: BluemapCapability[] = [
  {
    id: "s100-product-specification",
    title: "IHO S-100 국제표준 및 수로제품 사양 개발 역량",
    fitLevel: "core",
    keywords: [
      "S-100", "S100", "IHO", "Product Specification", "제품사양",
      "S-101", "S-102", "S-104", "S-111", "S-121", "S-122", "S-124", "S-128",
      "Feature Catalogue", "Portrayal Catalogue", "Application Schema", "DCEG",
      "GML", "Metadata", "Exchange Catalogue", "CATALOG.XML"
    ],
    strongFitSignals: [
      "S-100 기반 제품사양 개정·개발",
      "Feature Catalogue / Portrayal Catalogue / Application Schema 작성",
      "GML·Metadata Schema 및 Exchange Catalogue 산출물 요구",
      "IHO 표준, S-100 WG, S-101/S-121/S-201 등 국제표준 연계"
    ],
    cautionSignals: [
      "SPS-1000, GPS-100, IVS-1000 등 장비 모델명",
      "단순 S-100 문자열만 포함되고 수로·해양·IHO 맥락이 없는 공고"
    ],
    strengths: [
      "IHO S-100 국제표준을 핵심 기반으로 해양공간정보 SW를 개발하는 회사로, 표준 해석과 구현을 함께 수행할 수 있음",
      "S-100 계열 데이터 모델, 카탈로그, 스키마, 검증, 교환세트까지 이어지는 표준 산출물 흐름에 대한 이해 보유",
      "표준 적용자가 아니라 IHO·IALA 국제회의 참여를 통해 표준개발 절차에 직접 관여한 경험 보유"
    ],
    proposalAngles: [
      "표준 해석 → 모델·카탈로그·스키마 갱신 → 데이터셋 검증 → 산출물 추적성 확보 흐름으로 제안",
      "S-100 Ed. 변화가 각 산출물에 미치는 영향을 추적표와 검증 체크리스트로 관리",
      "국제표준 검토 경험과 산출물 품질검증 체계를 수주 차별점으로 제시"
    ],
    evidence: [
      "IHO·IALA 국제표준 회의 정기 참석",
      "S-100 Viewer, S-100 Validation Check, Web ECDIS, S-100 Web Map 제품 전환 준비",
      "S-100 데이터셋 검증·확인도구 설계 수행"
    ]
  },

  {
    id: "s100-validation-tooling",
    title: "S-100 데이터셋 제작·검증·뷰어 도구화 역량",
    fitLevel: "core",
    keywords: [
      "S-100 Validation", "Validation Check", "검증도구", "확인도구",
      "데이터셋", "Exchange Set", "Viewer", "OpenS-100", "Schema Validator",
      "GML Encoder", "FC Builder", "PC Builder", "심볼", "XSD", "품질검사"
    ],
    strongFitSignals: [
      "S-100 데이터셋 검증",
      "S-100 뷰어·검증도구·확인도구 개발",
      "스키마 검증, GML 인코딩, 카탈로그 생성, 심볼/Portrayal 검증",
      "검증 리포트, 테스트 데이터셋, Exchange Set 산출물 요구"
    ],
    cautionSignals: [
      "일반 데이터 검증, 일반 DB 품질검사처럼 해양/S-100 맥락이 없는 공고"
    ],
    strengths: [
      "FC Builder, PC Builder, Schema Validator, GML Encoder, 심볼 편집기 등 S-100 표준 인프라 도구 자체 구축 경험",
      "데이터셋 제작·검증·가시화·품질관리 흐름을 하나의 운영 절차로 제안 가능",
      "제품화 대상인 S-100 Viewer 및 Validation Check와 직접 연결되는 수주 분야"
    ],
    proposalAngles: [
      "검증 자동화와 수동 검토 절차를 병행한 품질관리 체계 제시",
      "검증 결과를 산출물·검수 기준·운영 매뉴얼과 연결",
      "향후 제품화 가능한 검증 도구/뷰어 확장성을 강조"
    ],
    evidence: [
      "S-100 데이터셋 검증·확인도구 설계",
      "OpenS-100 기반 도구 개발",
      "S-100 Viewer / Validation Check 제품 포트폴리오"
    ]
  },

  {
    id: "enc-ecdis-ecs-transition",
    title: "전자해도·ENC·ECDIS/ECS 및 S-57/S-100 전환 역량",
    fitLevel: "core",
    keywords: [
      "전자해도", "ENC", "S-57", "S-63", "S-98", "S-101",
      "ECDIS", "ECS", "항해장비", "선박항해통합장비", "적합성 평가",
      "PERMIT.XML", "User Permit", "수로제품", "바다내비"
    ],
    strongFitSignals: [
      "전자해도·바다내비용 수로제품 공급",
      "S-57/S-100 전환",
      "ECDIS/ECS 장비 연계 및 적합성 평가",
      "S-63 보안, User Permit, PERMIT.XML 등 전자해도 유통·보안"
    ],
    cautionSignals: [
      "일반 선박 장비 구매, 단순 항해장비 유지보수"
    ],
    strengths: [
      "전자해도·바다내비 수로제품 공급시스템 유지관리 경험",
      "IHO 해양 내비게이션 제조사(OEM) 공식 등록을 통한 User Permit 처리 권한 보유",
      "S-57/S-100, S-63, S-98 등 전자해도·항해장비 표준을 연결해 이해"
    ],
    proposalAngles: [
      "전자해도 데이터 유통, 보안, 장비 연계, 검증 기준을 통합 제안",
      "현행 S-57 기반 운영과 S-100 전환을 단계적으로 연결하는 전략 제시",
      "항해장비 적합성 평가 및 테스트 데이터 기반 검수 체계 강조"
    ],
    evidence: [
      "전자해도·바다내비 수로제품 공급시스템 유지관리",
      "IHO OEM 공식 등록",
      "ECS급 선박항해통합장비 적합성 평가 기준 요구사항 분석"
    ]
  },

  {
    id: "marine-geospatial-platform",
    title: "해양공간정보 플랫폼·웹맵·2D/3D 가시화 역량",
    fitLevel: "core",
    keywords: [
      "해양공간정보", "해양 GIS", "수로정보", "해도", "해양데이터",
      "S-100 Web Map", "Web Map", "OpenLayers", "Cesium", "3D Tiles",
      "OGC", "ISO", "CityGML", "WMS", "WFS", "디지털트윈", "가시화"
    ],
    strongFitSignals: [
      "해양공간정보 기반 GIS 플랫폼",
      "수로·해도·해양데이터 기반 웹맵/3D 가시화",
      "OGC/ISO/CityGML 등 공간표준 기반 데이터 처리",
      "KHOA/KRISO/MOF 등 해양 공공기관 발주"
    ],
    weakFitSignals: [
      "하수관로·상수도·일반 관로 GIS DB",
      "일반 행정 GIS DB 구축",
      "도시·토지·시설물 GIS 관리"
    ],
    cautionSignals: [
      "GIS설비, 가스절연개폐장치, 변전소, 154kV 등 전력설비 GIS",
      "GIST 등 GIS를 포함한 다른 단어"
    ],
    strengths: [
      "해양 도메인 데이터 특성을 반영한 2D/3D 지도 가시화와 표준 데이터 처리 역량",
      "OpenLayers, Cesium, 3D Tiles 기반 시각화와 S-57/S-100·OGC·ISO 데이터 연계 경험",
      "일반 GIS가 아니라 해양·수로·표준 데이터 기반 GIS 서비스에 강점"
    ],
    proposalAngles: [
      "해양 데이터 표준화, 지도 가시화, API 연계, 운영자 화면을 하나의 서비스 흐름으로 제안",
      "공간정보 품질관리와 해양 표준 데이터 확장성을 강조",
      "일반 시설물 GIS 공고는 해양 데이터 확장 가능성이 있는 경우에만 보수적으로 접근"
    ],
    evidence: [
      "GIS 기반 해양공간정보 서비스 기술",
      "S-100 Web Map 제품 전환 방향",
      "해양 디지털트윈·3D 가시화 관련 수행 경험"
    ]
  },

  {
    id: "enav-secom-mrn-security",
    title: "e-Navigation·SECOM·MCP·MRN 해상 데이터 교환 보안 역량",
    fitLevel: "core",
    keywords: [
      "e-Navigation", "이내비게이션", "eNav", "SECOM", "MCP", "MRN",
      "PKI", "인증서", "암호화", "전자서명", "해상통신",
      "Service Register", "Identity Register", "Connectivity Provider"
    ],
    strongFitSignals: [
      "SECOM 기반 해상 서비스 통신",
      "MCP/MRN 기반 식별체계",
      "PKI·전자서명·암호화 기반 해양 데이터 교환",
      "서비스 레지스트리·아이덴티티 레지스트리 구현"
    ],
    cautionSignals: [
      "일반 보안솔루션, 일반 인증서 관리 등 해상통신 맥락이 없는 보안 공고"
    ],
    strengths: [
      "SECOM 프로토콜 오픈소스 개발과 국제표준 적합성 검증 경험",
      "MCP/MRN 기반 해상 서비스 식별체계와 레지스트리 연계 경험",
      "S-100 Part 15, S-63 등 해양 데이터 보안 체계 구현 역량"
    ],
    proposalAngles: [
      "통신 프로토콜, 인증, 식별체계, 데이터 교환 절차를 분리해 설계",
      "서비스 등록·조회·구독·연계를 반복 가능한 운영 구조로 제안",
      "보안 요구사항을 산출물·검수 기준과 연결"
    ],
    evidence: [
      "SECOM 프로토콜 오픈소스화",
      "MRN 발급시스템 SW등록",
      "SECOM Connectivity Provider / Terminal / Register 제품 포트폴리오"
    ]
  },

  {
    id: "aton-iala-s200",
    title: "항로표지·IALA S-200/S-201 정보시스템 역량",
    fitLevel: "core",
    keywords: [
      "항로표지", "AtoN", "IALA", "S-200", "S-201", "등대", "부표",
      "ARM", "DCEG", "MRN", "항행안전시설", "AtoN Relay", "항로표지 DB"
    ],
    strongFitSignals: [
      "항로표지 정보관리시스템",
      "IALA S-200/S-201 표준 데이터",
      "AtoN MRN/API/DB 운영",
      "스마트 항로표지 및 연계기술"
    ],
    cautionSignals: [
      "일반 표지판, 도로안전시설 등 해양 항로표지가 아닌 공고"
    ],
    strengths: [
      "항로표지 정보관리시스템과 AtoN Relay 등 자체 SW 자산 보유",
      "IALA S-200/S-201 표준 데이터 구조와 항로표지 운영 업무를 함께 이해",
      "스마트 항로표지 및 연계기술 개발 수행 경험"
    ],
    proposalAngles: [
      "항로표지 자산 DB, MRN, API, 표준 데이터셋을 통합 관리하는 구조 제시",
      "국제표준 기반 데이터 교환과 기관 간 연계 가능성을 강조",
      "운영 현장 데이터와 표준 데이터 모델의 연결성을 제안 포인트로 활용"
    ],
    evidence: [
      "항로표지 정보관리시스템 SW등록",
      "AtoN Relay SW등록",
      "스마트 항로표지 및 연계기술 개발 수행"
    ]
  },

  {
    id: "digital-vts-maritime-traffic",
    title: "디지털 VTS·해상교통·차세대 해사정보서비스 역량",
    fitLevel: "core",
    keywords: [
      "VTS", "디지털 VTS", "관제", "해상교통", "해사정보",
      "S-210", "IVEF", "S-212", "모니터링", "관제시스템", "선박교통"
    ],
    strongFitSignals: [
      "디지털 VTS 국제표준 서비스",
      "해상교통 관제·모니터링",
      "S-210/IVEF/S-212 데이터 교환",
      "차세대 해사정보서비스"
    ],
    cautionSignals: [
      "일반 CCTV 관제, 도시관제, 시설관제 등 해상교통 맥락이 없는 공고"
    ],
    strengths: [
      "차세대 디지털 VTS 국제표준 서비스·장비 개발 공동 수행 경험",
      "해상교통 데이터 교환과 관제 업무 흐름을 이해한 서비스 설계 역량",
      "S-210, IVEF, S-212 등 VTS 관련 표준 활용 가능성"
    ],
    proposalAngles: [
      "관제 업무 흐름, 실시간 데이터 연계, 사용자 화면, 표준 교환체계를 함께 제안",
      "VTS 운영기관의 단계적 전환과 국제표준 대응을 강조",
      "관제 데이터의 품질·실시간성·표준 연계를 수주 차별점으로 제시"
    ],
    evidence: [
      "차세대 디지털 VTS 국제표준 서비스·장비 개발",
      "VTS 사용자 단말 SW 및 해사정보서비스 경험",
      "S-210/IVEF/S-212 표준 활용 가능성"
    ]
  },

  {
    id: "marine-data-ai-simulation",
    title: "해양데이터 분석·AI·시뮬레이션·디지털트윈 역량",
    fitLevel: "adjacent",
    keywords: [
      "해양데이터", "AI", "인공지능", "데이터분석", "분석활용",
      "시뮬레이션", "디지털트윈", "FMI", "수중", "세슘",
      "조위", "조류", "해류", "풍향", "풍속", "실시간", "가시화"
    ],
    strongFitSignals: [
      "해양데이터 기반 AI/분석",
      "수중환경·해양환경 시뮬레이션",
      "해양 디지털트윈 데이터모델",
      "조위·조류·해류 등 해양 환경 데이터 실시간 가시화"
    ],
    weakFitSignals: [
      "일반 AI 플랫폼",
      "일반 영상 생성 AI",
      "의료·교육·쇼핑몰 AI 서비스"
    ],
    cautionSignals: [
      "해양데이터 맥락 없이 AI/플랫폼/분석만 있는 공고"
    ],
    strengths: [
      "민군 활용 AI기반 융복합 해양데이터 분석 사업 수행",
      "수중 정보 모델링·FMI 시뮬레이션 테스트베드 연구 경험",
      "해양 디지털트윈 데이터모델과 실시간 가시화 경험"
    ],
    proposalAngles: [
      "해양 데이터 수집·품질검사·분석·가시화·시뮬레이션 흐름을 단계화",
      "AI는 해양데이터와 결합되는 경우에만 핵심 역량으로 강조",
      "분석 결과를 운영 의사결정 화면과 연결하는 전략 제시"
    ],
    evidence: [
      "민군 활용 AI기반 융복합 해양데이터 분석",
      "수중 정보 모델링·FMI 시뮬레이션 테스트베드 연구",
      "해양 디지털트윈 데이터모델·시뮬레이션 설계 연구"
    ]
  },

  {
    id: "maritime-system-integration-maintenance",
    title: "해양 공공시스템 통합 구축·유지관리 수행 역량",
    fitLevel: "supporting",
    keywords: [
      "유지관리", "운영지원", "고도화", "통합", "연계", "공급관리시스템",
      "해양정보서비스", "수로제품", "항해용 간행물", "장애 대응", "성능 개선", "마이그레이션"
    ],
    strongFitSignals: [
      "전자해도·바다내비 수로제품 공급시스템 유지관리",
      "항해용 간행물 통합 공급관리시스템",
      "해양 공공기관 운영시스템 고도화",
      "S-100/전자해도/해양데이터 운영시스템 유지관리"
    ],
    weakFitSignals: [
      "일반 연구장비 유지보수",
      "일반 행정시스템 유지관리",
      "단순 장비·부품·케이블 유지보수"
    ],
    cautionSignals: [
      "GIST 연구장비 유지보수",
      "SPS/GPS/IVS 등 장비 모델명 중심 유지보수",
      "계약대상자 외 참가 불가 수의시담"
    ],
    strengths: [
      "해양 공공기관 운영시스템의 유지관리·고도화·통합 구축 경험",
      "기존 운영 안정성을 유지하면서 신규 기능을 단계적으로 통합하는 수행 역량",
      "공공조달 대응 인증과 사업기획·개발조직을 보유"
    ],
    proposalAngles: [
      "현행 운영 안정성, 장애 대응, 보안 업데이트, 단계적 전환계획을 제안",
      "해양 도메인 지식이 필요한 운영시스템일 때 강점으로 활용",
      "일반 유지보수 공고는 해양·수로·표준 맥락이 있을 때만 적극 검토"
    ],
    evidence: [
      "전자해도·바다내비 수로제품 공급시스템 유지관리",
      "항해용 간행물 통합 공급관리시스템 구축",
      "imENC·eNavSys 유지관리 단독 수행"
    ]
  },

  {
    id: "quality-security-delivery",
    title: "보안·품질관리·검증 중심 사업수행 역량",
    fitLevel: "supporting",
    keywords: [
      "보안", "품질관리", "검수", "검증", "산출물", "추적성",
      "암호화", "로그", "SHA-256", "PKI", "ISO/IEC 25023", "IEEE 1016",
      "요구사항 추적표", "테스트", "품질"
    ],
    strongFitSignals: [
      "표준 산출물 검증",
      "요구사항 추적성과 산출물 품질관리",
      "해양 데이터 보안·암호화·인증",
      "공공 SW 사업 품질관리"
    ],
    cautionSignals: [
      "해양·표준·공공 SW 맥락이 없는 일반 보안장비 구매"
    ],
    strengths: [
      "S-100, SECOM, S-63 등 표준·보안·검증이 결합된 사업 수행 경험",
      "요구사항 추적, 산출물 검토, 검수 기준 설정을 전제로 한 사업관리 역량",
      "공공 SW 사업에서 필요한 보안·품질·산출물 체계 대응 가능"
    ],
    proposalAngles: [
      "보안 요구사항과 품질검수 기준을 요구사항 추적표에 연결",
      "착수·중간·완료 단계별 검증 체계와 산출물 승인 절차 제시",
      "표준 기반 검증 결과를 사업 리스크 저감 근거로 활용"
    ],
    evidence: [
      "S-100 Part 15, S-63 보안 구현 경험",
      "SECOM 보안 프로토콜 경험",
      "표준 데이터셋 검증·확인도구 설계"
    ]
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
