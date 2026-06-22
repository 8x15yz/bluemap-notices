import { getPool } from "@/lib/db";
import { shouldExcludeNoticeCandidate, type NoticeRuleConfig } from "@/lib/notice-rules";
import { scoreNoticeText } from "@/lib/scoring";

export const FILTER_RULE_TYPES = ["include_keyword", "it_signal", "non_it_exclude"] as const;

export type FilterRuleType = (typeof FILTER_RULE_TYPES)[number];

export interface FilterRule {
  id: number;
  ruleType: FilterRuleType;
  keyword: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FilterRuleGroups = Record<FilterRuleType, FilterRule[]>;

export interface ActiveFilterRuleConfig extends NoticeRuleConfig {
  includeKeywords: string[];
}

export interface FilterImpactNotice {
  id: string;
  title: string;
  organization?: string;
  score: number;
  matchedKeywords: string[];
  updatedAt: string;
}

export interface FilterImpactSummary {
  beforeCount: number;
  afterCount: number;
  excludedCount: number;
  recentExcluded: FilterImpactNotice[];
}

type FilterRuleRow = {
  id: string;
  rule_type: FilterRuleType;
  keyword: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type NoticeScoreSourceRow = {
  id: string;
  raw_keywords_text: string;
};

type FilterImpactNoticeRow = {
  id: string;
  title: string;
  organization: string | null;
  raw_keywords_text: string;
  metadata: Record<string, unknown>;
  updated_at: Date;
  score: number;
  matched_keywords: string[] | null;
};

export function isFilterRuleType(value: unknown): value is FilterRuleType {
  return typeof value === "string" && FILTER_RULE_TYPES.includes(value as FilterRuleType);
}

export function normalizeFilterKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function groupFilterRules(rules: FilterRule[]): FilterRuleGroups {
  return rules.reduce<FilterRuleGroups>(
    (groups, rule) => {
      groups[rule.ruleType].push(rule);
      return groups;
    },
    {
      include_keyword: [],
      it_signal: [],
      non_it_exclude: []
    }
  );
}

export async function listFilterRules(): Promise<FilterRule[]> {
  const pool = getPool();
  const result = await pool.query<FilterRuleRow>(
    `
      SELECT *
      FROM filter_rules
      ORDER BY
        rule_type ASC,
        enabled DESC,
        keyword ASC
    `
  );

  return result.rows.map(mapFilterRuleRow);
}

export async function getActiveFilterRuleConfig(): Promise<ActiveFilterRuleConfig> {
  const rules = await listFilterRules();
  const grouped = groupFilterRules(rules.filter((rule) => rule.enabled));

  return {
    includeKeywords: grouped.include_keyword.map((rule) => rule.keyword),
    itRelevantKeywords: grouped.it_signal.map((rule) => rule.keyword),
    nonItExclusionKeywords: grouped.non_it_exclude.map((rule) => rule.keyword)
  };
}

export async function getFilterImpactSummary(limit = 5): Promise<FilterImpactSummary> {
  const pool = getPool();
  const [config, result] = await Promise.all([
    getActiveFilterRuleConfig(),
    pool.query<FilterImpactNoticeRow>(
      `
        SELECT
          n.id,
          n.title,
          n.organization,
          n.raw_keywords_text,
          n.metadata,
          n.updated_at,
          ns.score,
          ns.matched_keywords
        FROM notices n
        JOIN notice_scores ns ON ns.notice_id = n.id
        ORDER BY n.updated_at DESC
        LIMIT 1000
      `
    )
  ]);
  const candidates = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    organization: row.organization ?? undefined,
    rawKeywordsText: row.raw_keywords_text,
    matchedKeywords: row.matched_keywords ?? [],
    metadata: row.metadata,
    score: row.score,
    updatedAt: row.updated_at.toISOString()
  }));
  const excluded = candidates.filter((notice) => shouldExcludeNoticeCandidate(notice, config));

  return {
    beforeCount: candidates.length,
    afterCount: candidates.length - excluded.length,
    excludedCount: excluded.length,
    recentExcluded: excluded.slice(0, limit).map((notice) => ({
      id: notice.id,
      title: notice.title,
      organization: notice.organization,
      score: notice.score,
      matchedKeywords: notice.matchedKeywords,
      updatedAt: notice.updatedAt
    }))
  };
}

export async function createFilterRule(params: {
  ruleType: FilterRuleType;
  keyword: string;
}): Promise<FilterRule> {
  const keyword = normalizeFilterKeyword(params.keyword);

  if (!keyword) {
    throw new Error("키워드를 입력해 주세요.");
  }

  const pool = getPool();
  const result = await pool.query<FilterRuleRow>(
    `
      INSERT INTO filter_rules (rule_type, keyword, keyword_normalized, enabled, updated_at)
      VALUES ($1, $2, $3, true, now())
      ON CONFLICT (rule_type, keyword_normalized) DO UPDATE SET
        keyword = EXCLUDED.keyword,
        enabled = true,
        updated_at = now()
      RETURNING *
    `,
    [params.ruleType, keyword, keyword.toLocaleLowerCase("ko-KR")]
  );

  return mapFilterRuleRow(result.rows[0]);
}

export async function setFilterRuleEnabled(id: number, enabled: boolean): Promise<void> {
  const pool = getPool();

  await pool.query(
    `
      UPDATE filter_rules
      SET enabled = $2,
          updated_at = now()
      WHERE id = $1
    `,
    [id, enabled]
  );
}

export async function deleteFilterRule(id: number): Promise<void> {
  const pool = getPool();

  await pool.query("DELETE FROM filter_rules WHERE id = $1", [id]);
}

export async function refreshStoredNoticeScoresForActiveKeywords(): Promise<number> {
  const pool = getPool();
  const { includeKeywords } = await getActiveFilterRuleConfig();
  const result = await pool.query<NoticeScoreSourceRow>(
    `
      SELECT id, raw_keywords_text
      FROM notices
    `
  );

  await Promise.all(
    result.rows.map((notice) => {
      const score = scoreNoticeText(notice.raw_keywords_text, includeKeywords);

      return pool.query(
        `
          INSERT INTO notice_scores (notice_id, score, matched_keywords, reason, updated_at)
          VALUES ($1, $2, $3, $4, now())
          ON CONFLICT (notice_id) DO UPDATE SET
            score = EXCLUDED.score,
            matched_keywords = EXCLUDED.matched_keywords,
            reason = EXCLUDED.reason,
            updated_at = now()
        `,
        [notice.id, score.score, score.matchedKeywords, score.reason]
      );
    })
  );

  return result.rowCount ?? 0;
}

function mapFilterRuleRow(row: FilterRuleRow): FilterRule {
  return {
    id: Number(row.id),
    ruleType: row.rule_type,
    keyword: row.keyword,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}
