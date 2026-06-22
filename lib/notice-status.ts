import type { NoticeRecord } from "@/lib/types";

export const HIGH_SCORE_THRESHOLD = 36;
export const URGENT_DEADLINE_DAYS = 7;

export type NoticeStatus = {
  isHighScore: boolean;
  isUrgent: boolean;
  isSlackSent: boolean;
  hasAnalysisReport: boolean;
  daysUntilDeadline?: number;
};

export function getNoticeStatus(notice: NoticeRecord, now = new Date()): NoticeStatus {
  const daysUntilDeadline = getDaysUntilDeadline(notice.deadlineAt, now);

  return {
    isHighScore: notice.score >= HIGH_SCORE_THRESHOLD,
    isUrgent:
      typeof daysUntilDeadline === "number" &&
      daysUntilDeadline >= 0 &&
      daysUntilDeadline <= URGENT_DEADLINE_DAYS,
    isSlackSent: notice.slackNotified,
    hasAnalysisReport: notice.hasAnalysisReport === true,
    daysUntilDeadline
  };
}

export function getDaysUntilDeadline(value?: string, now = new Date()): number | undefined {
  if (!value) {
    return undefined;
  }

  const deadline = new Date(value);

  if (Number.isNaN(deadline.getTime())) {
    return undefined;
  }

  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
