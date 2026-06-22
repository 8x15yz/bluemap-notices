import { getPool } from "@/lib/db";
import { EXCLUDED_WINNER_METHOD, hasExcludedWinnerMethod, shouldExcludeNoticeCandidate } from "@/lib/notice-rules";
import { getActiveFilterRuleConfig } from "@/lib/repositories/filter-rules";
import type { AnalysisReport, NormalizedNotice, NoticeRecord } from "@/lib/types";

export type NoticeListParams = {
  query?: string;
  deadline?: "urgent";
  limit?: number;
};

type NoticeRow = {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  url: string;
  published_at: Date | null;
  deadline_at: Date | null;
  organization: string | null;
  budget_amount: string | null;
  category: NoticeRecord["category"];
  summary: string | null;
  raw_keywords_text: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  score: number | null;
  matched_keywords: string[] | null;
  reason: string | null;
  slack_notified: boolean;
  has_analysis_report?: boolean;
};

type AnalysisReportRow = {
  id: string;
  notice_id: string;
  file_name: string;
  file_type: string;
  document_markdown: string;
  strategy_memo: string;
  model_provider: string;
  created_at: Date;
};

export function isExcludedFromSlackNotification(metadata: Record<string, unknown>): boolean {
  return hasExcludedWinnerMethod(metadata);
}

export function buildNoticeId(sourceId: string, externalId: string): string {
  const normalized = externalId.replace(/[^a-zA-Z0-9가-힣_-]+/g, "_");
  return `${sourceId}_${normalized}`;
}

export async function upsertNotice(notice: NormalizedNotice): Promise<{ id: string; created: boolean }> {
  const pool = getPool();
  const id = buildNoticeId(notice.sourceId, notice.externalId);
  const existing = await pool.query<{ id: string }>("SELECT id FROM notices WHERE id = $1", [id]);
  const created = existing.rowCount === 0;

  await pool.query(
    `
      INSERT INTO notices (
        id, source_id, external_id, title, url, published_at, deadline_at, organization,
        budget_amount, category, summary, raw_keywords_text, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        published_at = EXCLUDED.published_at,
        deadline_at = EXCLUDED.deadline_at,
        organization = EXCLUDED.organization,
        budget_amount = EXCLUDED.budget_amount,
        category = EXCLUDED.category,
        summary = EXCLUDED.summary,
        raw_keywords_text = EXCLUDED.raw_keywords_text,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      id,
      notice.sourceId,
      notice.externalId,
      notice.title,
      notice.url,
      notice.publishedAt ?? null,
      notice.deadlineAt ?? null,
      notice.organization ?? null,
      notice.budgetAmount ?? null,
      notice.category,
      notice.summary ?? null,
      notice.rawKeywordsText,
      notice.metadata
    ]
  );

  await pool.query(
    `
      INSERT INTO notice_scores (notice_id, score, matched_keywords, reason, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (notice_id) DO UPDATE SET
        score = EXCLUDED.score,
        matched_keywords = EXCLUDED.matched_keywords,
        reason = EXCLUDED.reason,
        updated_at = now()
    `,
    [id, notice.score, notice.matchedKeywords, notice.scoreReason]
  );

  return { id, created };
}

export async function listNotices(params: NoticeListParams = {}): Promise<NoticeRecord[]> {
  const pool = getPool();
  const limit = params.limit ?? 100;
  const fetchLimit = limit * 5;
  const query = params.query?.trim();
  const values: Array<string | number> = [`%${EXCLUDED_WINNER_METHOD}%`];
  const where = ["COALESCE(n.metadata->>'winnerMethod', '') NOT ILIKE $1"];

  if (query) {
    values.push(`%${query}%`);
    where.push(
      `(n.title ILIKE $${values.length} OR n.organization ILIKE $${values.length} OR n.raw_keywords_text ILIKE $${values.length} OR ns.reason ILIKE $${values.length} OR array_to_string(ns.matched_keywords, ' ') ILIKE $${values.length})`
    );
  }

  if (params.deadline === "urgent") {
    where.push("n.deadline_at >= now() AND n.deadline_at <= now() + interval '7 days'");
  }

  values.push(fetchLimit);
  const result = await pool.query<NoticeRow>(
    `
      SELECT
        n.*,
        ns.score,
        ns.matched_keywords,
        ns.reason,
        EXISTS (
          SELECT 1 FROM slack_notifications sn
          WHERE sn.notice_id = n.id AND sn.status = 'sent'
        ) AS slack_notified,
        EXISTS (
          SELECT 1 FROM analysis_reports ar
          WHERE ar.notice_id = n.id
        ) AS has_analysis_report
      FROM notices n
      JOIN notice_scores ns ON ns.notice_id = n.id
      WHERE ${where.join(" AND ")}
      ORDER BY
        ns.score DESC,
        n.deadline_at ASC NULLS LAST,
        n.updated_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  const filterConfig = await getActiveFilterRuleConfig();

  return result.rows
    .map(mapNoticeRow)
    .filter((notice) => !shouldExcludeNoticeCandidate(notice, filterConfig))
    .slice(0, limit);
}

export async function getNotice(id: string): Promise<NoticeRecord | null> {
  const pool = getPool();
  const result = await pool.query<NoticeRow>(
    `
      SELECT
        n.*,
        ns.score,
        ns.matched_keywords,
        ns.reason,
        EXISTS (
          SELECT 1 FROM slack_notifications sn
          WHERE sn.notice_id = n.id AND sn.status = 'sent'
        ) AS slack_notified,
        EXISTS (
          SELECT 1 FROM analysis_reports ar
          WHERE ar.notice_id = n.id
        ) AS has_analysis_report
      FROM notices n
      JOIN notice_scores ns ON ns.notice_id = n.id
      WHERE n.id = $1
    `,
    [id]
  );

  return result.rows[0] ? mapNoticeRow(result.rows[0]) : null;
}

export async function listPendingSlackNotices(): Promise<NoticeRecord[]> {
  const pool = getPool();
  const result = await pool.query<NoticeRow>(
    `
      SELECT
        n.*,
        ns.score,
        ns.matched_keywords,
        ns.reason,
        false AS slack_notified
      FROM notices n
      JOIN notice_scores ns ON ns.notice_id = n.id
      WHERE ns.score > 0
        AND COALESCE(n.deadline_at, now() + interval '1 day') >= now()
        AND COALESCE(n.metadata->>'winnerMethod', '') NOT ILIKE $1
        AND NOT EXISTS (
          SELECT 1 FROM slack_notifications sn
          WHERE sn.notice_id = n.id AND sn.status = 'sent'
        )
      ORDER BY ns.score DESC, n.deadline_at ASC NULLS LAST
      LIMIT 100
    `,
    [`%${EXCLUDED_WINNER_METHOD}%`]
  );

  const filterConfig = await getActiveFilterRuleConfig();

  return result.rows
    .map(mapNoticeRow)
    .filter((notice) => !shouldExcludeNoticeCandidate(notice, filterConfig))
    .slice(0, 20);
}

export async function recordSlackNotification(params: {
  noticeId: string;
  status: "sent" | "failed";
  message?: string;
}): Promise<void> {
  const pool = getPool();

  await pool.query(
    `
      INSERT INTO slack_notifications (notice_id, status, message)
      VALUES ($1, $2, $3)
    `,
    [params.noticeId, params.status, params.message ?? null]
  );
}

export async function createAnalysisReport(params: {
  noticeId: string;
  fileName: string;
  fileType: string;
  documentMarkdown: string;
  strategyMemo: string;
  modelProvider: string;
}): Promise<AnalysisReport> {
  const pool = getPool();
  const result = await pool.query<AnalysisReportRow>(
    `
      INSERT INTO analysis_reports (
        notice_id, file_name, file_type, document_markdown, strategy_memo, model_provider
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      params.noticeId,
      params.fileName,
      params.fileType,
      params.documentMarkdown,
      params.strategyMemo,
      params.modelProvider
    ]
  );

  return mapAnalysisRow(result.rows[0]);
}

export async function listAnalysisReports(noticeId: string): Promise<AnalysisReport[]> {
  const pool = getPool();
  const result = await pool.query<AnalysisReportRow>(
    `
      SELECT *
      FROM analysis_reports
      WHERE notice_id = $1
      ORDER BY created_at DESC
    `,
    [noticeId]
  );

  return result.rows.map(mapAnalysisRow);
}

export async function getAnalysisReport(noticeId: string, reportId: number): Promise<AnalysisReport | null> {
  const pool = getPool();
  const result = await pool.query<AnalysisReportRow>(
    `
      SELECT *
      FROM analysis_reports
      WHERE notice_id = $1
        AND id = $2
    `,
    [noticeId, reportId]
  );

  return result.rows[0] ? mapAnalysisRow(result.rows[0]) : null;
}

function mapNoticeRow(row: NoticeRow): NoticeRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at?.toISOString(),
    deadlineAt: row.deadline_at?.toISOString(),
    organization: row.organization ?? undefined,
    budgetAmount: row.budget_amount ? Number(row.budget_amount) : undefined,
    category: row.category,
    summary: row.summary ?? undefined,
    rawKeywordsText: row.raw_keywords_text,
    matchedKeywords: row.matched_keywords ?? [],
    score: row.score ?? 0,
    scoreReason: row.reason ?? "",
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    slackNotified: row.slack_notified,
    hasAnalysisReport: row.has_analysis_report ?? false
  };
}

function mapAnalysisRow(row: AnalysisReportRow): AnalysisReport {
  return {
    id: Number(row.id),
    noticeId: row.notice_id,
    fileName: row.file_name,
    fileType: row.file_type,
    documentMarkdown: row.document_markdown,
    strategyMemo: row.strategy_memo,
    modelProvider: row.model_provider,
    createdAt: row.created_at.toISOString()
  };
}
