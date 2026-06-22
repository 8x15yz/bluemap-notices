import { enrichG2bNoticeWithDetail, g2bSource } from "@/lib/api/g2b";
import { getOptionalNumberEnv } from "@/lib/config/env";
import {
  listPendingSlackNotices,
  recordSlackNotification,
  upsertNotice
} from "@/lib/repositories/notices";
import { recordSlackDigestThread } from "@/lib/repositories/slack-digests";
import { shouldExcludeNoticeCandidate } from "@/lib/notice-rules";
import { getActiveFilterRuleConfig } from "@/lib/repositories/filter-rules";
import { matchKeywords, rescoreNotice } from "@/lib/scoring";
import { getSlackDigestItems, sendSlackDigest } from "@/lib/services/slack";
import type { SyncSummary } from "@/lib/types";
import { daysAgo, isFutureOrToday } from "@/lib/utils/dates";

export async function syncG2bNotices(): Promise<SyncSummary> {
  const lookbackDays = getOptionalNumberEnv("SYNC_LOOKBACK_DAYS", 2);
  const maxPages = getOptionalNumberEnv("SYNC_MAX_PAGES", 3);
  const rawNotices = await g2bSource.fetchNotices({
    startDate: daysAgo(lookbackDays),
    endDate: new Date(),
    maxPages,
    numOfRows: 100
  });
  const filterConfig = await getActiveFilterRuleConfig();

  let stored = 0;
  let candidates = 0;

  for (const rawNotice of rawNotices) {
    const notice = rescoreNotice(g2bSource.normalize(rawNotice), filterConfig.includeKeywords);
    const hasCandidateKeywordSignal = matchKeywords(notice.rawKeywordsText, filterConfig.includeKeywords).length > 0;

    if (
      !hasCandidateKeywordSignal ||
      !isFutureOrToday(notice.deadlineAt) ||
      shouldExcludeNoticeCandidate(notice, filterConfig)
    ) {
      continue;
    }

    candidates += 1;
    const enrichedNotice = rescoreNotice(await enrichG2bNoticeWithDetail(notice), filterConfig.includeKeywords);
    await upsertNotice(enrichedNotice);
    stored += 1;
  }

  const notificationSummary = await notifyPendingSlackNotices();

  return {
    fetched: rawNotices.length,
    stored,
    candidates,
    notified: notificationSummary.notified,
    skippedNotifications: notificationSummary.skipped
  };
}

async function notifyPendingSlackNotices(): Promise<{ notified: number; skipped: number }> {
  const pendingNotices = await listPendingSlackNotices();

  if (pendingNotices.length === 0) {
    return { notified: 0, skipped: 0 };
  }

  const result = await sendSlackDigest(pendingNotices);

  if (result.status === "sent") {
    if (result.channelId && result.messageTs) {
      await recordSlackDigestThread({
        channelId: result.channelId,
        messageTs: result.messageTs,
        message: result.message,
        items: getSlackDigestItems(pendingNotices).map((notice, index) => ({
          itemIndex: index + 1,
          noticeId: notice.id
        }))
      });
    }

    await Promise.all(
      pendingNotices.map((notice) =>
        recordSlackNotification({
          noticeId: notice.id,
          status: "sent",
          message: result.message
        })
      )
    );

    return { notified: pendingNotices.length, skipped: 0 };
  }

  if (result.status === "failed") {
    await Promise.all(
      pendingNotices.map((notice) =>
        recordSlackNotification({
          noticeId: notice.id,
          status: "failed",
          message: result.message
        })
      )
    );
  }

  return { notified: 0, skipped: pendingNotices.length };
}
