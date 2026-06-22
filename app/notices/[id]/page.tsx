import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Paperclip } from "lucide-react";
import { AnalysisSubmitButton } from "@/app/notices/[id]/analysis-submit-button";
import { notFound } from "next/navigation";
import { MemoCopyButton } from "@/app/notices/[id]/memo-copy-button";
import { ProposalDraftModal, type ProposalAnalysisReportOption } from "@/app/notices/[id]/proposal-draft-modal";
import { buildBluemapRecommendationReason } from "@/lib/bluemap-capabilities";
import { renderMarkdown } from "@/lib/markdown";
import { getNotice, listAnalysisReports } from "@/lib/repositories/notices";
import { listProposalDraftsByNotice } from "@/lib/repositories/proposal-drafts";
import { getScoreToneClass } from "@/lib/score-tone";
import { hasAnalysisReportForFile } from "@/lib/services/analysis-report-status";
import { isSupportedDocumentFileName } from "@/lib/services/document-parser";
import type { AnalysisReport, NoticeRecord } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils/dates";

type NoticePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    analysis?: string;
    analysisError?: string;
  }>;
};

type DetailAttachment = {
  sequence?: number;
  name?: string;
  url?: string;
};

type G2bDetailView = {
  attachments: DetailAttachment[];
  possibleRegions?: string;
  possibleIndustries?: string;
  contractMethod?: string;
  awardMethod?: string;
  detailUrl?: string;
  assignedBudget?: number;
  estimatedPrice?: number;
  fetchedAt?: string;
};

export default async function NoticePage({ params, searchParams }: NoticePageProps) {
  const { id } = await params;
  const query = await searchParams;
  const notice = await getNotice(decodeURIComponent(id));

  if (!notice) {
    notFound();
  }

  const reports = await listAnalysisReports(notice.id);
  const proposalDrafts = await listProposalDraftsByNotice(notice.id);
  const bidDetail = getG2bDetailView(notice.metadata);

  return (
    <>
      <div className="actions" style={{ marginBottom: 16 }}>
        <a className="button secondary" href="/">
          <ArrowLeft size={16} />
          목록으로
        </a>
        <a className="button" href={notice.url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          원문 열기
        </a>
      </div>

      {query.analysis ? <div className="notice-alert">{getAnalysisMessage(query.analysis)}</div> : null}
      {query.analysisError ? <div className="notice-alert error">{query.analysisError}</div> : null}

      <section className="notice-detail">
        <article className="panel detail-main">
          <h2>{notice.title}</h2>
          <div className="notice-meta">
            <span>{notice.organization ?? "기관 미확인"}</span>
            <span>나라장터</span>
            <span>{notice.slackNotified ? "Slack 알림 완료" : "Slack 알림 대기"}</span>
          </div>

          <div className="detail-grid">
            <DataPoint label="적합도" value={`${notice.score}점`} toneClass={getScoreToneClass(notice.score)} />
            <DataPoint label="마감" value={formatDateLabel(notice.deadlineAt)} />
            <DataPoint label="공고일" value={formatDateLabel(notice.publishedAt)} />
            <DataPoint label="예산" value={formatBudget(notice.budgetAmount)} />
          </div>

          <h3>추천 근거</h3>
          <p>{buildBluemapRecommendationReason(notice)}</p>

          <div className="keyword-row">
            {notice.matchedKeywords.map((keyword) => (
              <span className="chip" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: 28 }}>입찰 상세</h3>
          <BidDetailPanel notice={notice} detail={bidDetail} reports={reports} />

          <h3 style={{ marginTop: 28 }}>공고 분석</h3>
          <ReportList reports={reports} />
        </article>

        <aside className="panel detail-aside">
          <h2>첨부파일 분석</h2>
          <p className="notice-meta">공고문 PDF, HWPX 또는 HWP를 올리면 제안 전략을 정리합니다.</p>
          <form
            className="upload-box"
            action={`/api/notices/${encodeURIComponent(notice.id)}/analyze`}
            method="post"
            encType="multipart/form-data"
          >
            <input className="file-input" type="file" name="document" accept=".pdf,.hwpx,.hwp" required />
            <AnalysisSubmitButton idleLabel="분석 시작" pendingLabel="분석 중" variant="upload" />
          </form>

          <div className="detail-grid" style={{ gridTemplateColumns: "1fr", marginTop: 16 }}>
            <DataPoint label="출처 ID" value={notice.externalId} />
            <DataPoint label="업무 구분" value={String(notice.metadata.businessDivision ?? "미확인")} />
          </div>
          <ProposalDraftModal
            noticeId={notice.id}
            reports={toProposalReportOptions(reports)}
            initialDrafts={proposalDrafts}
          />
        </aside>
      </section>
    </>
  );
}

function BidDetailPanel({ notice, detail, reports }: { notice: NoticeRecord; detail: G2bDetailView | null; reports: AnalysisReport[] }) {
  const possibleRegions = detail?.possibleRegions ?? getMetadataString(notice.metadata, "possibleRegions") ?? "지역 제한 미확인";
  const possibleIndustries =
    detail?.possibleIndustries ?? getMetadataString(notice.metadata, "possibleIndustries") ?? "업종 제한 미확인";
  const contractMethod = detail?.contractMethod ?? getMetadataString(notice.metadata, "contractMethod") ?? "계약 방식 미확인";
  const awardMethod = detail?.awardMethod ?? getMetadataString(notice.metadata, "winnerMethod") ?? "낙찰 방식 미확인";
  const attachments = detail?.attachments.filter((attachment) => attachment.name || attachment.url) ?? [];

  return (
    <div className="bid-detail-panel">
      <div className="detail-grid">
        <DataPoint label="참가 가능 지역" value={possibleRegions} />
        <DataPoint label="투찰 가능 업종" value={possibleIndustries} />
        <DataPoint label="계약 방식" value={contractMethod} />
        <DataPoint label="낙찰 방식" value={awardMethod} />
        <DataPoint label="배정 예산" value={formatBudget(detail?.assignedBudget)} />
        <DataPoint label="추정 가격" value={formatBudget(detail?.estimatedPrice)} />
      </div>

      <div className="attachment-section">
        <div className="attachment-header">
          <strong>첨부파일</strong>
          {detail?.fetchedAt ? <span>{formatDateLabel(detail.fetchedAt)} 기준</span> : null}
        </div>
        {attachments.length > 0 ? (
          <div className="attachment-list">
            {attachments.map((attachment, index) => {
              const attachmentName = attachment.name || `첨부파일 ${index + 1}`;
              const isAnalyzed = hasAnalysisReportForFile(reports, attachmentName);
              const canAnalyze = isSupportedDocumentFileName(attachmentName) && typeof attachment.sequence === "number" && !isAnalyzed;

              return (
                <div className="attachment-row" key={`${attachment.sequence ?? index}-${attachment.name ?? attachment.url}`}>
                  <a className="attachment-item" href={getAttachmentDownloadHref(notice.id, attachment)} download={attachment.name || undefined}>
                    <Paperclip size={16} />
                    <span>{attachmentName}</span>
                  </a>
                  {isAnalyzed ? (
                    <span className="attachment-analysis-complete">
                      <CheckCircle2 size={14} />
                      분석 완료
                    </span>
                  ) : canAnalyze ? (
                    <form className="attachment-analysis-form" action={getAttachmentAnalyzeAction(notice.id, attachment)} method="post">
                      <AnalysisSubmitButton
                        className="button secondary compact-button attachment-analysis-button"
                        estimateText="보통 30초~2분 걸립니다."
                        idleLabel="분석"
                        pendingLabel="분석 중"
                        variant="file"
                      />
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty compact">상세 API에서 확인된 첨부파일이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function getAnalysisMessage(value: string): string {
  if (value === "existing") {
    return "이미 분석된 파일입니다.";
  }

  return "공고 분석을 생성했습니다.";
}

function DataPoint({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) {
  return (
    <div className={`data-point${toneClass ? ` score-data-point ${toneClass}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getAttachmentDownloadHref(noticeId: string, attachment: DetailAttachment): string {
  if (typeof attachment.sequence !== "number") {
    return "#";
  }

  return `/api/notices/${encodeURIComponent(noticeId)}/attachments/${attachment.sequence}/download`;
}

function getAttachmentAnalyzeAction(noticeId: string, attachment: DetailAttachment): string {
  if (typeof attachment.sequence !== "number") {
    return "#";
  }

  return `/api/notices/${encodeURIComponent(noticeId)}/attachments/${attachment.sequence}/analyze`;
}

function ReportList({ reports }: { reports: AnalysisReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="empty">
        <FileText size={22} />
        <p>아직 생성된 공고 분석이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="report-list">
      {reports.map((report) => (
        <article className="report" key={report.id}>
          <div className="report-header">
            <div className="notice-meta">
              <span>{report.fileName}</span>
              <span>{report.modelProvider}</span>
              <span>{formatDateLabel(report.createdAt)}</span>
            </div>
            <MemoCopyButton memo={report.strategyMemo} />
          </div>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(report.strategyMemo)
            }}
          />
        </article>
      ))}
    </div>
  );
}

function toProposalReportOptions(reports: AnalysisReport[]): ProposalAnalysisReportOption[] {
  return reports.map((report) => ({
    id: report.id,
    fileName: report.fileName,
    modelProvider: report.modelProvider,
    createdAt: report.createdAt
  }));
}

function formatBudget(value?: number): string {
  if (!value) {
    return "금액 미확인";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function getG2bDetailView(metadata: Record<string, unknown>): G2bDetailView | null {
  const detail = metadata.detail;

  if (!detail || typeof detail !== "object") {
    return null;
  }

  const record = detail as Record<string, unknown>;
  const attachments = Array.isArray(record.attachments)
    ? record.attachments.filter(isAttachment).map((attachment) => ({
        sequence: typeof attachment.sequence === "number" ? attachment.sequence : undefined,
        name: typeof attachment.name === "string" ? attachment.name : undefined,
        url: typeof attachment.url === "string" ? attachment.url : undefined
      }))
    : [];

  return {
    attachments,
    possibleRegions: getRecordString(record, "possibleRegions"),
    possibleIndustries: getRecordString(record, "possibleIndustries"),
    contractMethod: getRecordString(record, "contractMethod"),
    awardMethod: getRecordString(record, "awardMethod"),
    detailUrl: getRecordString(record, "detailUrl"),
    assignedBudget: getRecordNumber(record, "assignedBudget"),
    estimatedPrice: getRecordNumber(record, "estimatedPrice"),
    fetchedAt: getRecordString(record, "fetchedAt")
  };
}

function isAttachment(value: unknown): value is DetailAttachment {
  return Boolean(value && typeof value === "object");
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  return getRecordString(metadata, key);
}

function getRecordString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRecordNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
