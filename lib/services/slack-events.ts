import { createHmac, timingSafeEqual } from "node:crypto";
import { findSlackDigestNoticeByItem } from "@/lib/repositories/slack-digests";
import { listAnalysisReports } from "@/lib/repositories/notices";
import { generateSlackThreadAnswer } from "@/lib/services/llm";
import { buildSlackThreadReply, getNoticeDetailUrl, postSlackThreadReply } from "@/lib/services/slack";

const SLACK_SIGNATURE_VERSION = "v0";
const MAX_SIGNATURE_AGE_SECONDS = 60 * 5;

export type SlackEventHandleResult =
  | { status: "answered"; itemIndex: number }
  | { status: "ignored"; reason: string }
  | { status: "failed"; reason: string };

export type SlackMessageEvent = {
  type?: string;
  subtype?: string;
  channel?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
};

export function verifySlackSignature(params: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret?: string;
  now?: number;
}): boolean {
  if (!params.signingSecret || !params.timestamp || !params.signature) {
    return false;
  }

  const timestampSeconds = Number(params.timestamp);
  const nowSeconds = Math.floor((params.now ?? Date.now()) / 1000);

  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_SIGNATURE_AGE_SECONDS) {
    return false;
  }

  const base = `${SLACK_SIGNATURE_VERSION}:${params.timestamp}:${params.body}`;
  const expected = `${SLACK_SIGNATURE_VERSION}=${createHmac("sha256", params.signingSecret).update(base).digest("hex")}`;

  return safeCompare(expected, params.signature);
}

export function extractSlackNoticeItemIndex(text: string): number | null {
  const normalized = text.replace(/<@[A-Z0-9]+>/g, " ").replace(/\s+/g, " ").trim();
  const directMatch = /(?:^|[^\d])(\d{1,2})\s*(?:번|번째)/.exec(normalized);

  if (directMatch) {
    return Number(directMatch[1]);
  }

  const noticeMatch = /공고\s*(\d{1,2})/.exec(normalized);
  return noticeMatch ? Number(noticeMatch[1]) : null;
}

export async function handleSlackThreadEvent(event: SlackMessageEvent): Promise<SlackEventHandleResult> {
  if (event.type !== "message" && event.type !== "app_mention") {
    return { status: "ignored", reason: "unsupported_event" };
  }

  if (event.bot_id || event.subtype) {
    return { status: "ignored", reason: "bot_or_subtype_event" };
  }

  if (!event.channel || !event.thread_ts || !event.text) {
    return { status: "ignored", reason: "missing_thread_context" };
  }

  const itemIndex = extractSlackNoticeItemIndex(event.text);

  if (!itemIndex) {
    await postSlackThreadReply({
      channelId: event.channel,
      threadTs: event.thread_ts,
      text: "몇 번 공고인지 알려주세요. 예: `3번 공고는 왜 적합도가 12점이야?`"
    });

    return { status: "ignored", reason: "missing_item_index" };
  }

  const notice = await findSlackDigestNoticeByItem({
    channelId: event.channel,
    threadTs: event.thread_ts,
    itemIndex
  });

  if (!notice) {
    await postSlackThreadReply({
      channelId: event.channel,
      threadTs: event.thread_ts,
      text: `${itemIndex}번 공고를 이 Slack 알림에서 찾지 못했습니다. 웹 목록에서 최신 후보를 확인해주세요.`
    });

    return { status: "failed", reason: "notice_not_found" };
  }

  const fallbackReply = buildSlackThreadReply({
    itemIndex,
    notice,
    questionText: event.text
  });
  const reply = await buildAiBackedSlackReply({
    itemIndex,
    notice,
    questionText: event.text,
    fallbackReply
  });

  const result = await postSlackThreadReply({
    channelId: event.channel,
    threadTs: event.thread_ts,
    text: reply
  });

  if (result.status !== "sent") {
    return { status: "failed", reason: result.message };
  }

  return { status: "answered", itemIndex };
}

async function buildAiBackedSlackReply(params: {
  itemIndex: number;
  notice: NonNullable<Awaited<ReturnType<typeof findSlackDigestNoticeByItem>>>;
  questionText: string;
  fallbackReply: string;
}): Promise<string> {
  try {
    const analysisReports = params.notice.hasAnalysisReport ? await listAnalysisReports(params.notice.id) : [];
    const answer = await generateSlackThreadAnswer({
      itemIndex: params.itemIndex,
      notice: params.notice,
      questionText: params.questionText,
      analysisReport: analysisReports[0]
    });

    return ensureSlackReplyDetailUrl(answer.answer, params.notice.id);
  } catch {
    return params.fallbackReply;
  }
}

function ensureSlackReplyDetailUrl(text: string, noticeId: string): string {
  const detailUrl = getNoticeDetailUrl(noticeId);

  if (text.includes(detailUrl)) {
    return text;
  }

  return `${text}\n\n자세한 내용: ${detailUrl}`;
}

function safeCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
