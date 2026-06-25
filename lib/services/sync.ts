import { enrichG2bNoticeWithDetail, g2bSource } from "@/lib/api/g2b";
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

export type SyncProgressEvent =
  | { phase: "fetching"; page: number; maxPages: number; fetched: number }
  | { phase: "processing"; fetched: number; processed: number; candidates: number };

// 매일 도는 크론을 전제로 오늘 + 어제(크론 1회 실패 대비 버퍼)만 본다. 날짜별로 totalCount를
// 전부 수집하므로 더 늘려도 누락은 없지만, 그만큼 호출량이 늘어나니 환경변수로 임의로
// 늘어나지 않도록 고정값으로 둔다. 필요하면 params.lookbackDays로만 명시적으로 override한다.
const DEFAULT_LOOKBACK_DAYS = 1;

export async function syncG2bNotices(params?: {
  lookbackDays?: number;
  notifySlack?: boolean;
  onProgress?: (event: SyncProgressEvent) => void;
}): Promise<SyncSummary> {
  const lookbackDays = params?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const rawNotices = await g2bSource.fetchNotices({
    startDate: daysAgo(lookbackDays),
    endDate: new Date(),
    numOfRows: 100,
    onPageFetched: (page, knownTotalPages, fetched) => {
      params?.onProgress?.({ phase: "fetching", page, maxPages: knownTotalPages, fetched });
    }
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
    params?.onProgress?.({ phase: "processing", fetched: rawNotices.length, processed: stored, candidates });
  }

  const notificationSummary =
    params?.notifySlack === true
      ? await notifyPendingSlackNotices()
      : { notified: 0, skipped: 0 };

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
