import { getRequiredEnv } from "@/lib/config/env";
import { applyScore } from "@/lib/scoring";
import type { FetchNoticeParams, NoticeSource, NormalizedNotice } from "@/lib/types";
import { formatG2bDateTime, parseKoreanDateTime } from "@/lib/utils/dates";
import { compactText } from "@/lib/utils/text";

const DEFAULT_G2B_STANDARD_BASE_URL = "http://apis.data.go.kr/1230000/ao/PubDataOpnStdService";
const DEFAULT_G2B_BID_PUBLIC_BASE_URL = "http://apis.data.go.kr/1230000/ad/BidPublicInfoService";
const DETAIL_FETCH_TIMEOUT_MS = 15000;

// 정상적인 일일 발행량(수천 건)을 한참 넘는 totalCount가 돌아오면 API 응답 이상으로 간주한다.
// 평소 수집 상한이 아니라, 그런 비정상 상황에서만 걸리는 안전 가드다.
const HARD_SAFETY_MAX_PAGES_PER_DAY = 500;

const detailOperationByBusinessDivision: Record<string, G2bBidDetailOperation> = {
  공사: "getBidPblancListInfoCnstwk",
  용역: "getBidPblancListInfoServc",
  물품: "getBidPblancListInfoThng",
  외자: "getBidPblancListInfoFrgcpt",
  기타: "getBidPblancListInfoEtc"
};

const fallbackDetailOperations: G2bBidDetailOperation[] = [
  "getBidPblancListInfoServc",
  "getBidPblancListInfoThng",
  "getBidPblancListInfoCnstwk",
  "getBidPblancListInfoEtc",
  "getBidPblancListInfoFrgcpt"
];

export interface G2bBidNotice {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  refNtceNo?: string;
  bidNtceNm?: string;
  bidNtceSttusNm?: string;
  bidNtceDate?: string;
  bidNtceBgn?: string;
  bsnsDivNm?: string;
  ntceInsttNm?: string;
  dmndInsttNm?: string;
  bidClseDate?: string;
  bidClseTm?: string;
  opengDate?: string;
  opengTm?: string;
  asignBdgtAmt?: string;
  presmptPrce?: string;
  prtcptPsblRgnNm?: string;
  bidprcPsblIndstrytyNm?: string;
  indstrytyLmtYn?: string;
  rgnLmtYn?: string;
  bidNtceUrl?: string;
  cntrctCnclsMthdNm?: string;
  bidwinrDcsnMthdNm?: string;
  [key: string]: string | undefined;
}

export type G2bBidDetailOperation =
  | "getBidPblancListInfoCnstwk"
  | "getBidPblancListInfoServc"
  | "getBidPblancListInfoThng"
  | "getBidPblancListInfoFrgcpt"
  | "getBidPblancListInfoEtc";

export interface G2bBidDetail extends G2bBidNotice {
  bidNtceDtlUrl?: string;
  sucsfbidMthdNm?: string;
  presmptPrce?: string;
  stdNtceDocUrl?: string;
  ntceSpecDocUrl1?: string;
  ntceSpecDocUrl2?: string;
  ntceSpecDocUrl3?: string;
  ntceSpecDocUrl4?: string;
  ntceSpecDocUrl5?: string;
  ntceSpecDocUrl6?: string;
  ntceSpecDocUrl7?: string;
  ntceSpecDocUrl8?: string;
  ntceSpecDocUrl9?: string;
  ntceSpecDocUrl10?: string;
  ntceSpecFileNm1?: string;
  ntceSpecFileNm2?: string;
  ntceSpecFileNm3?: string;
  ntceSpecFileNm4?: string;
  ntceSpecFileNm5?: string;
  ntceSpecFileNm6?: string;
  ntceSpecFileNm7?: string;
  ntceSpecFileNm8?: string;
  ntceSpecFileNm9?: string;
  ntceSpecFileNm10?: string;
}

export interface G2bNoticeAttachment {
  sequence: number;
  name: string;
  url: string;
}

export interface G2bBidDetailSummary {
  sourceService: "BidPublicInfoService";
  operation: G2bBidDetailOperation;
  fetchedAt: string;
  detailUrl?: string;
  noticeUrl?: string;
  attachments: G2bNoticeAttachment[];
  possibleRegions?: string;
  possibleIndustries?: string;
  contractMethod?: string;
  awardMethod?: string;
  assignedBudget?: number;
  estimatedPrice?: number;
  raw: G2bBidDetail;
}

interface G2bResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: unknown;
      totalCount?: number | string;
    };
  };
}

interface G2bDetailFetchParams {
  bidNtceNo: string;
  bidNtceOrd?: string;
  businessDivision?: string;
}

export const g2bSource: NoticeSource<G2bBidNotice> = {
  sourceId: "g2b",
  displayName: "나라장터",

  // 날짜 범위를 통째로 조회하면 나라장터 일일 발행량(수천 건)이 고정 페이지 상한을 넘는 순간
  // 그 이후 공고는 통째로 누락된다. 날짜 단위로 쪼개서 각 날짜의 1페이지 응답에서 totalCount를
  // 먼저 확인하고, requiredPages(=ceil(totalCount/numOfRows))를 전부 수집한다.
  async fetchNotices(params: FetchNoticeParams): Promise<G2bBidNotice[]> {
    const items: G2bBidNotice[] = [];
    const days = enumerateDays(params.startDate, params.endDate);
    let pagesCompletedAcrossDoneDays = 0;

    for (const day of days) {
      const firstPage = await fetchG2bPage({
        startDate: day,
        endDate: day,
        numOfRows: params.numOfRows,
        pageNo: 1
      });

      items.push(...firstPage.items);

      const requiredPages = firstPage.totalCount > 0
        ? Math.ceil(firstPage.totalCount / params.numOfRows)
        : 1;

      if (requiredPages > HARD_SAFETY_MAX_PAGES_PER_DAY) {
        throw new Error(
          `[g2b] ${formatG2bDateTime(day)} totalCount=${firstPage.totalCount}건이 비정상적으로 큽니다 ` +
            `(requiredPages=${requiredPages} > 안전 상한 ${HARD_SAFETY_MAX_PAGES_PER_DAY}). ` +
            `API 응답 이상으로 판단해 동기화를 중단합니다.`
        );
      }

      params.onPageFetched?.(pagesCompletedAcrossDoneDays + 1, pagesCompletedAcrossDoneDays + requiredPages, items.length);

      for (let pageNo = 2; pageNo <= requiredPages; pageNo += 1) {
        const page = await fetchG2bPage({
          startDate: day,
          endDate: day,
          numOfRows: params.numOfRows,
          pageNo
        });

        items.push(...page.items);
        params.onPageFetched?.(pagesCompletedAcrossDoneDays + pageNo, pagesCompletedAcrossDoneDays + requiredPages, items.length);

        if (page.items.length < params.numOfRows) {
          break;
        }
      }

      pagesCompletedAcrossDoneDays += requiredPages;
    }

    return items;
  },

  normalize(raw: G2bBidNotice): NormalizedNotice {
    const externalId = compactText([raw.bidNtceNo, raw.bidNtceOrd || "000"]).replace(/\s+/g, "-");
    const title = raw.bidNtceNm?.trim() || "제목 없는 나라장터 공고";
    const organization = raw.dmndInsttNm || raw.ntceInsttNm || undefined;
    const budgetAmount = parseAmount(raw.asignBdgtAmt) ?? parseAmount(raw.presmptPrce);
    const publishedAt = parseKoreanDateTime(raw.bidNtceDate, raw.bidNtceBgn);
    const deadlineAt = parseKoreanDateTime(raw.bidClseDate, raw.bidClseTm);
    const rawKeywordsText = compactText([
      title,
      organization,
      raw.ntceInsttNm,
      raw.bsnsDivNm,
      raw.bidNtceSttusNm,
      raw.prtcptPsblRgnNm,
      raw.bidprcPsblIndstrytyNm,
      raw.cntrctCnclsMthdNm,
      raw.bidwinrDcsnMthdNm
    ]);

    return applyScore({
      sourceId: "g2b",
      externalId,
      title,
      url: raw.bidNtceUrl || "https://www.g2b.go.kr",
      publishedAt,
      deadlineAt,
      organization,
      budgetAmount,
      category: "bid",
      summary: raw.bsnsDivNm ? `${raw.bsnsDivNm} 공고` : undefined,
      rawKeywordsText,
      metadata: {
        bidNtceNo: raw.bidNtceNo,
        bidNtceOrd: raw.bidNtceOrd,
        businessDivision: raw.bsnsDivNm,
        noticeStatus: raw.bidNtceSttusNm,
        noticeInstitution: raw.ntceInsttNm,
        demandInstitution: raw.dmndInsttNm,
        openingDate: raw.opengDate,
        openingTime: raw.opengTm,
        industryLimit: raw.indstrytyLmtYn,
        regionLimit: raw.rgnLmtYn,
        possibleRegions: raw.prtcptPsblRgnNm,
        possibleIndustries: raw.bidprcPsblIndstrytyNm,
        contractMethod: raw.cntrctCnclsMthdNm,
        winnerMethod: raw.bidwinrDcsnMthdNm
      }
    });
  }
};

interface G2bPageParams {
  startDate: Date;
  endDate: Date;
  numOfRows: number;
  pageNo: number;
}

interface G2bPageResult {
  items: G2bBidNotice[];
  totalCount: number;
}

async function fetchG2bPage(params: G2bPageParams): Promise<G2bPageResult> {
  const serviceKey = getRequiredEnv("G2B_SERVICE_KEY");
  const baseUrl = process.env.G2B_STANDARD_API_BASE_URL || DEFAULT_G2B_STANDARD_BASE_URL;
  const searchParams = new URLSearchParams({
    numOfRows: String(params.numOfRows),
    pageNo: String(params.pageNo),
    type: "json",
    bidNtceBgnDt: formatG2bDateTime(params.startDate),
    bidNtceEndDt: formatG2bDateTime(params.endDate, true)
  });

  const url = `${baseUrl}/getDataSetOpnStdBidPblancInfo?${searchParams.toString()}&ServiceKey=${normalizeServiceKey(serviceKey)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`나라장터 API 호출 실패: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as G2bResponse;
  const resultCode = payload.response?.header?.resultCode;
  const resultMsg = payload.response?.header?.resultMsg;

  if (resultCode && resultCode !== "00") {
    throw new Error(`나라장터 API 오류: ${resultCode} ${resultMsg ?? ""}`.trim());
  }

  const totalCount = Number(payload.response?.body?.totalCount ?? 0) || 0;
  const items = payload.response?.body?.items;

  if (!items) {
    return { items: [], totalCount };
  }

  return { items: normalizeG2bItems(items), totalCount };
}

function enumerateDays(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function fetchG2bBidDetail(params: G2bDetailFetchParams): Promise<G2bBidDetailSummary | null> {
  const operations = getDetailOperations(params.businessDivision);
  let lastError: Error | undefined;

  for (const operation of operations) {
    let details: G2bBidDetail[];

    try {
      details = await fetchG2bDetailOperation(operation, params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("입찰공고정보서비스 상세 조회에 실패했습니다.");
      continue;
    }

    const matched = findMatchingDetail(details, params.bidNtceOrd);

    if (matched) {
      return buildG2bBidDetailSummary(operation, matched);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function enrichG2bNoticeWithDetail(notice: NormalizedNotice): Promise<NormalizedNotice> {
  const bidNtceNo = asString(notice.metadata.bidNtceNo);

  if (notice.sourceId !== "g2b" || !bidNtceNo) {
    return notice;
  }

  try {
    const detail = await fetchG2bBidDetail({
      bidNtceNo,
      bidNtceOrd: asString(notice.metadata.bidNtceOrd),
      businessDivision: asString(notice.metadata.businessDivision)
    });

    if (!detail) {
      return {
        ...notice,
        metadata: {
          ...notice.metadata,
          detailStatus: {
            status: "not_found",
            fetchedAt: new Date().toISOString()
          }
        }
      };
    }

    return mergeG2bDetail(notice, detail);
  } catch (error) {
    return {
      ...notice,
      metadata: {
        ...notice.metadata,
        detailStatus: {
          status: "failed",
          fetchedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : "입찰공고정보서비스 상세 조회에 실패했습니다."
        }
      }
    };
  }
}

async function fetchG2bDetailOperation(
  operation: G2bBidDetailOperation,
  params: G2bDetailFetchParams
): Promise<G2bBidDetail[]> {
  const serviceKey = getRequiredEnv("G2B_SERVICE_KEY");
  const baseUrls = getBidPublicBaseUrls();
  const searchParams = new URLSearchParams({
    type: "json",
    inqryDiv: "2",
    bidNtceNo: params.bidNtceNo,
    pageNo: "1",
    numOfRows: "10"
  });

  if (params.bidNtceOrd) {
    searchParams.set("bidNtceOrd", params.bidNtceOrd);
  }

  let lastError: Error | undefined;

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}/${operation}?${searchParams.toString()}&ServiceKey=${normalizeServiceKey(serviceKey)}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, application/xml;q=0.9, text/xml;q=0.9"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(DETAIL_FETCH_TIMEOUT_MS)
    });

    if (response.ok) {
      return parseG2bDetailPayload(await response.text());
    }

    const body = await response.text().catch(() => "");
    const message = body.trim() ? `나라장터 상세 API 호출 실패: HTTP ${response.status} ${body.trim()}` : `나라장터 상세 API 호출 실패: HTTP ${response.status}`;
    lastError = new Error(message);
  }

  throw lastError ?? new Error("나라장터 상세 API 호출 실패");
}

function parseG2bDetailPayload(text: string): G2bBidDetail[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const payload = JSON.parse(trimmed) as G2bResponse;
    const resultCode = payload.response?.header?.resultCode;
    const resultMsg = payload.response?.header?.resultMsg;

    if (resultCode && resultCode !== "00") {
      throw new Error(`나라장터 상세 API 오류: ${resultCode} ${resultMsg ?? ""}`.trim());
    }

    return normalizeG2bItems(payload.response?.body?.items) as G2bBidDetail[];
  }

  return parseG2bXmlItems(trimmed);
}

function parseG2bXmlItems(xml: string): G2bBidDetail[] {
  const resultCode = getXmlTagValue(xml, "resultCode");
  const resultMsg = getXmlTagValue(xml, "resultMsg");

  if (resultCode && resultCode !== "00") {
    throw new Error(`나라장터 상세 API 오류: ${resultCode} ${resultMsg ?? ""}`.trim());
  }

  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return itemMatches.map((itemXml) => {
    const detail: G2bBidDetail = {};
    const tagPattern = /<([a-zA-Z][\w]*)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(itemXml)) !== null) {
      detail[match[1]] = decodeHtml(match[2].trim());
    }

    return detail;
  });
}

function getXmlTagValue(xml: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`).exec(xml);
  return match ? decodeHtml(match[1].trim()) : undefined;
}

function getDetailOperations(businessDivision?: string): G2bBidDetailOperation[] {
  const preferred = businessDivision
    ? Object.entries(detailOperationByBusinessDivision).find(([label]) => businessDivision.includes(label))?.[1]
    : undefined;

  if (!preferred) {
    return fallbackDetailOperations;
  }

  return [preferred, ...fallbackDetailOperations.filter((operation) => operation !== preferred)];
}

function getBidPublicBaseUrls(): string[] {
  const configured = process.env.G2B_BID_PUBLIC_API_BASE_URL || DEFAULT_G2B_BID_PUBLIC_BASE_URL;
  const normalized = configured.replace(/\/$/, "");
  const legacyAdjusted = normalized.replace(/\/ad\/BidPublicInfoService$/, "/BidPublicInfoService");
  const adAdjusted = normalized.endsWith("/ad/BidPublicInfoService")
    ? normalized
    : normalized.replace(/\/BidPublicInfoService$/, "/ad/BidPublicInfoService");
  const candidates = [
    normalized,
    adAdjusted,
    legacyAdjusted,
    DEFAULT_G2B_BID_PUBLIC_BASE_URL,
    "http://apis.data.go.kr/1230000/BidPublicInfoService02"
  ];

  return Array.from(new Set(candidates));
}

function findMatchingDetail(details: G2bBidDetail[], bidNtceOrd?: string): G2bBidDetail | undefined {
  if (!bidNtceOrd) {
    return details[0];
  }

  return details.find((detail) => detail.bidNtceOrd === bidNtceOrd) ?? details[0];
}

function buildG2bBidDetailSummary(
  operation: G2bBidDetailOperation,
  detail: G2bBidDetail
): G2bBidDetailSummary {
  return {
    sourceService: "BidPublicInfoService",
    operation,
    fetchedAt: new Date().toISOString(),
    detailUrl: detail.bidNtceDtlUrl || detail.bidNtceUrl,
    noticeUrl: detail.bidNtceUrl,
    attachments: extractG2bAttachments(detail),
    possibleRegions: emptyToUndefined(detail.prtcptPsblRgnNm),
    possibleIndustries: emptyToUndefined(detail.bidprcPsblIndstrytyNm),
    contractMethod: emptyToUndefined(detail.cntrctCnclsMthdNm),
    awardMethod: emptyToUndefined(detail.sucsfbidMthdNm ?? detail.bidwinrDcsnMthdNm),
    assignedBudget: parseAmount(detail.asignBdgtAmt),
    estimatedPrice: parseAmount(detail.presmptPrce),
    raw: detail
  };
}

function extractG2bAttachments(detail: G2bBidDetail): G2bNoticeAttachment[] {
  const attachments: G2bNoticeAttachment[] = [];

  for (let sequence = 1; sequence <= 10; sequence += 1) {
    const name = emptyToUndefined(detail[`ntceSpecFileNm${sequence}`]);
    const url = emptyToUndefined(detail[`ntceSpecDocUrl${sequence}`]);

    if (name || url) {
      attachments.push({
        sequence,
        name: name ?? `첨부파일 ${sequence}`,
        url: url ?? ""
      });
    }
  }

  const standardNoticeUrl = emptyToUndefined(detail.stdNtceDocUrl);
  const alreadyIncluded = standardNoticeUrl
    ? attachments.some((attachment) => attachment.url === standardNoticeUrl)
    : true;

  if (standardNoticeUrl && !alreadyIncluded) {
    attachments.unshift({
      sequence: 0,
      name: "표준 공고서",
      url: standardNoticeUrl
    });
  }

  return attachments;
}

function mergeG2bDetail(notice: NormalizedNotice, detail: G2bBidDetailSummary): NormalizedNotice {
  const rawDetail = detail.raw;
  const budgetAmount = detail.assignedBudget ?? detail.estimatedPrice ?? notice.budgetAmount;
  const url = detail.detailUrl ?? detail.noticeUrl ?? notice.url;
  const organization = rawDetail.dmndInsttNm || rawDetail.ntceInsttNm || notice.organization;
  const contractMethod = detail.contractMethod ?? asString(notice.metadata.contractMethod);
  const winnerMethod = detail.awardMethod ?? asString(notice.metadata.winnerMethod);
  const possibleRegions = detail.possibleRegions ?? asString(notice.metadata.possibleRegions);
  const possibleIndustries = detail.possibleIndustries ?? asString(notice.metadata.possibleIndustries);

  return {
    ...notice,
    url,
    organization,
    budgetAmount,
    rawKeywordsText: compactText([
      notice.rawKeywordsText,
      rawDetail.cntrctCnclsMthdNm,
      rawDetail.sucsfbidMthdNm,
      rawDetail.bidprcPsblIndstrytyNm,
      rawDetail.prtcptPsblRgnNm,
      detail.attachments.map((attachment) => attachment.name).join(" ")
    ]),
    metadata: {
      ...notice.metadata,
      detail,
      detailStatus: {
        status: "fetched",
        fetchedAt: detail.fetchedAt,
        operation: detail.operation
      },
      possibleRegions,
      possibleIndustries,
      contractMethod,
      winnerMethod
    }
  };
}

function normalizeG2bItems(items: unknown): G2bBidNotice[] {
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items as G2bBidNotice[];
  }

  if (typeof items === "object" && "item" in items) {
    const item = (items as { item?: unknown }).item;

    if (!item) {
      return [];
    }

    return Array.isArray(item) ? (item as G2bBidNotice[]) : [item as G2bBidNotice];
  }

  return [items as G2bBidNotice];
}

function parseAmount(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeServiceKey(serviceKey: string): string {
  return serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function emptyToUndefined(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? decodeHtml(normalized) : undefined;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}
