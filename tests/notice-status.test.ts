import { describe, expect, it } from "vitest";
import { getDaysUntilDeadline, getNoticeStatus } from "@/lib/notice-status";
import type { NoticeRecord } from "@/lib/types";

const TEST_NOW = new Date("2026-06-17T00:00:00.000Z");

describe("notice status", () => {
  it("marks high score, urgent deadline, Slack sent, and analysis memo state", () => {
    const status = getNoticeStatus(
      createNotice({
        score: 36,
        deadlineAt: "2026-06-20T00:00:00.000Z",
        slackNotified: true,
        hasAnalysisReport: true
      }),
      TEST_NOW
    );

    expect(status).toMatchObject({
      isHighScore: true,
      isUrgent: true,
      isSlackSent: true,
      hasAnalysisReport: true,
      daysUntilDeadline: 3
    });
  });

  it("does not mark passed or unknown deadlines as urgent", () => {
    expect(getNoticeStatus(createNotice({ deadlineAt: "2026-06-16T00:00:00.000Z" }), TEST_NOW).isUrgent).toBe(false);
    expect(getNoticeStatus(createNotice({ deadlineAt: undefined }), TEST_NOW).isUrgent).toBe(false);
  });

  it("returns undefined for invalid deadline values", () => {
    expect(getDaysUntilDeadline("not-a-date", TEST_NOW)).toBeUndefined();
  });
});

function createNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: "g2b_R25BK00933743_000",
    sourceId: "g2b",
    externalId: "R25BK00933743-000",
    title: "해양공간정보 GIS 플랫폼 고도화 용역",
    url: "https://www.g2b.go.kr/link/example",
    organization: "해양수산부",
    deadlineAt: "2026-06-30T00:00:00.000Z",
    category: "bid",
    rawKeywordsText: "해양공간정보 GIS 플랫폼",
    matchedKeywords: ["해양공간정보", "GIS", "플랫폼"],
    score: 24,
    scoreReason: "해양공간정보, GIS, 플랫폼 키워드가 공고 내용과 맞습니다.",
    metadata: {},
    createdAt: TEST_NOW.toISOString(),
    updatedAt: TEST_NOW.toISOString(),
    slackNotified: false,
    hasAnalysisReport: false,
    ...overrides
  };
}
