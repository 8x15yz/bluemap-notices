export type NoticeCategory =
  | "bid"
  | "rnd"
  | "support"
  | "voucher"
  | "certification"
  | "other";

export type NoticeMetadata = Record<string, unknown>;

export interface NormalizedNotice {
  sourceId: string;
  externalId: string;
  title: string;
  url: string;
  publishedAt?: string;
  deadlineAt?: string;
  organization?: string;
  budgetAmount?: number;
  category: NoticeCategory;
  summary?: string;
  rawKeywordsText: string;
  matchedKeywords: string[];
  score: number;
  scoreReason: string;
  metadata: NoticeMetadata;
}

export interface NoticeRecord extends NormalizedNotice {
  id: string;
  createdAt: string;
  updatedAt: string;
  slackNotified: boolean;
  hasAnalysisReport?: boolean;
  isActiveCandidate?: boolean;
}

export interface AnalysisReport {
  id: number;
  noticeId: string;
  fileName: string;
  fileType: string;
  documentMarkdown: string;
  strategyMemo: string;
  modelProvider: string;
  createdAt: string;
}

export type ProposalDraftMessageRole = "user" | "assistant";

export interface ProposalDraftMessage {
  id: number;
  draftId: number;
  role: ProposalDraftMessageRole;
  content: string;
  createdAt: string;
}

export interface ProposalDraft {
  id: number;
  noticeId: string;
  analysisReportId: number;
  contentMarkdown: string;
  modelProvider: string;
  createdAt: string;
  updatedAt: string;
  messages: ProposalDraftMessage[];
}

export interface FetchNoticeParams {
  startDate: Date;
  endDate: Date;
  numOfRows: number;
  onPageFetched?: (pageNo: number, knownTotalPages: number, totalFetched: number) => void;
}

export interface NoticeSource<TRawNotice = unknown> {
  sourceId: string;
  displayName: string;
  fetchNotices(params: FetchNoticeParams): Promise<TRawNotice[]>;
  normalize(raw: TRawNotice): NormalizedNotice;
}

export interface SyncSummary {
  fetched: number;
  stored: number;
  candidates: number;
  notified: number;
  skippedNotifications: number;
}
