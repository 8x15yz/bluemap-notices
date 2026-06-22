import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractSlackNoticeItemIndex, verifySlackSignature } from "@/lib/services/slack-events";

describe("slack events", () => {
  it("verifies Slack request signatures", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = "1718000000";
    const signingSecret = "test-signing-secret";
    const signature = signSlackRequest({ body, timestamp, signingSecret });

    expect(
      verifySlackSignature({
        body,
        timestamp,
        signature,
        signingSecret,
        now: 1718000000000
      })
    ).toBe(true);
  });

  it("rejects stale Slack request signatures", () => {
    const body = JSON.stringify({ type: "event_callback" });
    const timestamp = "1718000000";
    const signingSecret = "test-signing-secret";
    const signature = signSlackRequest({ body, timestamp, signingSecret });

    expect(
      verifySlackSignature({
        body,
        timestamp,
        signature,
        signingSecret,
        now: 1718001000000
      })
    ).toBe(false);
  });

  it("extracts a notice number from Slack thread text", () => {
    expect(extractSlackNoticeItemIndex("3번 공고는 왜 적합도가 12점이야?")).toBe(3);
    expect(extractSlackNoticeItemIndex("<@U123> 7번째 공고 요약해줘")).toBe(7);
    expect(extractSlackNoticeItemIndex("공고 2번 리스크는?")).toBe(2);
    expect(extractSlackNoticeItemIndex("이 공고 왜 좋아?")).toBeNull();
  });
});

function signSlackRequest(params: {
  body: string;
  timestamp: string;
  signingSecret: string;
}): string {
  const base = `v0:${params.timestamp}:${params.body}`;
  return `v0=${createHmac("sha256", params.signingSecret).update(base).digest("hex")}`;
}
