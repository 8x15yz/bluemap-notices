import { getPool } from "@/lib/db";
import { ensureNoticeScoreRescoreColumns } from "@/lib/repositories/migrations";
import { getActiveFilterRuleConfig } from "@/lib/repositories/filter-rules";
import { scoreNoticeText, SCORING_VERSION } from "@/lib/scoring";

export interface RescoreSummary {
  dryRun: boolean;
  scoringVersion: string;
  totalNotices: number;
  updated: number;
  activated: number;
  deactivated: number;
}

type RescoreSourceRow = {
  id: string;
  raw_keywords_text: string;
  score: number;
  matched_keywords: string[] | null;
  is_active_candidate: boolean;
};

function sameKeywords(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

// Recomputes score/matchedKeywords/is_active_candidate for every stored notice using the
// current scoring logic. Never touches slack_notifications and never sends Slack
// notifications - this is a maintenance operation, not a sync.
export async function rescoreAllNotices(params: { dryRun: boolean }): Promise<RescoreSummary> {
  await ensureNoticeScoreRescoreColumns();

  const pool = getPool();
  const { includeKeywords } = await getActiveFilterRuleConfig();

  const result = await pool.query<RescoreSourceRow>(`
    SELECT n.id, n.raw_keywords_text, ns.score, ns.matched_keywords, ns.is_active_candidate
    FROM notices n
    JOIN notice_scores ns ON ns.notice_id = n.id
  `);

  let updated = 0;
  let activated = 0;
  let deactivated = 0;

  await Promise.all(
    result.rows.map(async (row) => {
      const rescored = scoreNoticeText(row.raw_keywords_text, includeKeywords);
      const isActiveCandidate = rescored.score > 0;
      const inactiveReason = isActiveCandidate
        ? null
        : rescored.breakdown.exclusionReason ?? "키워드 매칭 신호가 없어 재채점으로 비활성 처리되었습니다.";

      const scoreChanged = row.score !== rescored.score;
      const keywordsChanged = !sameKeywords(row.matched_keywords ?? [], rescored.matchedKeywords);
      const activeChanged = row.is_active_candidate !== isActiveCandidate;

      if (scoreChanged || keywordsChanged || activeChanged) {
        updated += 1;
      }
      if (activeChanged && isActiveCandidate) activated += 1;
      if (activeChanged && !isActiveCandidate) deactivated += 1;

      if (params.dryRun) {
        return;
      }

      await pool.query(
        `
          UPDATE notice_scores
          SET score = $2,
              matched_keywords = $3,
              reason = $4,
              is_active_candidate = $5,
              scoring_version = $6,
              rescored_at = now(),
              inactive_reason = $7,
              updated_at = now()
          WHERE notice_id = $1
        `,
        [
          row.id,
          rescored.score,
          rescored.matchedKeywords,
          rescored.reason,
          isActiveCandidate,
          SCORING_VERSION,
          inactiveReason
        ]
      );
    })
  );

  return {
    dryRun: params.dryRun,
    scoringVersion: SCORING_VERSION,
    totalNotices: result.rowCount ?? 0,
    updated,
    activated,
    deactivated
  };
}
