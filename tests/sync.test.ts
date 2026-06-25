import { afterEach, describe, expect, it, vi } from "vitest";
import { syncG2bNotices } from "@/lib/services/sync";
import { listPendingSlackNotices, recordSlackNotification } from "@/lib/repositories/notices";
import { sendSlackDigest } from "@/lib/services/slack";

vi.mock("@/lib/api/g2b", () => ({
  g2bSource: {
    fetchNotices: vi.fn().mockResolvedValue([]),
    normalize: vi.fn()
  },
  enrichG2bNoticeWithDetail: vi.fn()
}));

vi.mock("@/lib/repositories/filter-rules", () => ({
  getActiveFilterRuleConfig: vi.fn().mockResolvedValue({ includeKeywords: [] })
}));

vi.mock("@/lib/repositories/notices", () => ({
  listPendingSlackNotices: vi.fn(),
  recordSlackNotification: vi.fn(),
  upsertNotice: vi.fn()
}));

vi.mock("@/lib/repositories/slack-digests", () => ({
  recordSlackDigestThread: vi.fn()
}));

vi.mock("@/lib/services/slack", () => ({
  sendSlackDigest: vi.fn(),
  getSlackDigestItems: vi.fn().mockReturnValue([])
}));

const listPendingSlackNoticesMock = vi.mocked(listPendingSlackNotices);
const recordSlackNotificationMock = vi.mocked(recordSlackNotification);
const sendSlackDigestMock = vi.mocked(sendSlackDigest);

describe("syncG2bNotices notifySlack gating", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips Slack entirely when notifySlack is not passed (manual default)", async () => {
    const summary = await syncG2bNotices();

    expect(listPendingSlackNoticesMock).not.toHaveBeenCalled();
    expect(sendSlackDigestMock).not.toHaveBeenCalled();
    expect(recordSlackNotificationMock).not.toHaveBeenCalled();
    expect(summary.notified).toBe(0);
    expect(summary.skippedNotifications).toBe(0);
  });

  it("skips Slack entirely when notifySlack is false (manual mode)", async () => {
    const summary = await syncG2bNotices({ notifySlack: false });

    expect(listPendingSlackNoticesMock).not.toHaveBeenCalled();
    expect(sendSlackDigestMock).not.toHaveBeenCalled();
    expect(recordSlackNotificationMock).not.toHaveBeenCalled();
    expect(summary.notified).toBe(0);
    expect(summary.skippedNotifications).toBe(0);
  });

  it("sends Slack and records sent notifications when notifySlack is true (cron mode)", async () => {
    const pendingNotice = { id: "notice-1" } as never;
    listPendingSlackNoticesMock.mockResolvedValue([pendingNotice]);
    sendSlackDigestMock.mockResolvedValue({ status: "sent", message: "ok" } as never);

    const summary = await syncG2bNotices({ notifySlack: true });

    expect(listPendingSlackNoticesMock).toHaveBeenCalledTimes(1);
    expect(sendSlackDigestMock).toHaveBeenCalledTimes(1);
    expect(recordSlackNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ noticeId: "notice-1", status: "sent" })
    );
    expect(summary.notified).toBe(1);
    expect(summary.skippedNotifications).toBe(0);
  });
});
