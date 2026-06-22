import { getAppBaseUrl } from "@/lib/config/env";
import type { NoticeRecord } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils/dates";
import { truncateText } from "@/lib/utils/text";

const DIGEST_ITEM_LIMIT = 10;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

export interface SlackSendResult {
  status: "sent" | "skipped" | "failed";
  message: string;
  channelId?: string;
  messageTs?: string;
  transport?: "bot" | "webhook";
}

export function getNoticeDetailUrl(noticeId: string): string {
  return `${getAppBaseUrl()}/notices/${encodeURIComponent(noticeId)}`;
}

export function buildSlackPayload(notice: NoticeRecord): Record<string, unknown> {
  const detailUrl = getNoticeDetailUrl(notice.id);
  const keywords = notice.matchedKeywords.slice(0, 8).join(", ");
  const title = truncateText(notice.title, 130);

  return {
    text: `[${notice.score}점] ${title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${escapeSlack(title)}*\n${escapeSlack(notice.organization ?? "기관 미확인")} · 마감 ${escapeSlack(formatDateLabel(notice.deadlineAt))}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*적합도*\n${notice.score}점`
          },
          {
            type: "mrkdwn",
            text: `*매칭 키워드*\n${escapeSlack(keywords || "없음")}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: escapeSlack(notice.scoreReason)
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "상세 보기"
            },
            url: detailUrl
          }
        ]
      }
    ]
  };
}

export function buildSlackDigestPayload(notices: NoticeRecord[]): Record<string, unknown> {
  const shownNotices = getSlackDigestItems(notices);
  const hiddenCount = Math.max(0, notices.length - shownNotices.length);
  const title = `나라장터 후보 공고 ${notices.length}건`;
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: title
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "새 후보 공고가 발견됐습니다. 점수가 높은 순서대로 확인해보세요."
      }
    },
    {
      type: "divider"
    }
  ];

  for (const [index, notice] of shownNotices.entries()) {
    const detailUrl = getNoticeDetailUrl(notice.id);
    const noticeTitle = escapeSlack(truncateText(notice.title, 90));
    const organization = escapeSlack(notice.organization ?? "기관 미확인");
    const deadline = escapeSlack(formatDateLabel(notice.deadlineAt));
    const keywords = escapeSlack(notice.matchedKeywords.slice(0, 5).join(", ") || "없음");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${index + 1}. <${detailUrl}|${noticeTitle}>*\n${organization} · 마감 ${deadline} · ${notice.score}점\n키워드: ${keywords}`
      }
    });
  }

  if (hiddenCount > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `외 ${hiddenCount}건은 웹에서 확인하세요.`
        }
      ]
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "웹에서 전체 보기"
        },
        url: getAppBaseUrl()
      }
    ]
  });

  return {
    text: title,
    blocks
  };
}

export function getSlackDigestItems(notices: NoticeRecord[]): NoticeRecord[] {
  return notices.slice(0, DIGEST_ITEM_LIMIT);
}

export async function sendSlackNotice(notice: NoticeRecord): Promise<SlackSendResult> {
  return postSlackPayload(buildSlackPayload(notice), "Slack 알림을 보냈습니다.");
}

export async function sendSlackDigest(notices: NoticeRecord[]): Promise<SlackSendResult> {
  if (notices.length === 0) {
    return {
      status: "skipped",
      message: "보낼 Slack 후보 공고가 없습니다."
    };
  }

  return postSlackPayload(buildSlackDigestPayload(notices), `Slack 묶음 알림을 보냈습니다: ${notices.length}건`);
}

export function buildSlackThreadReply(params: {
  itemIndex: number;
  notice: NoticeRecord;
  questionText?: string;
}): string {
  const intent = detectSlackThreadReplyIntent(params.questionText);

  if (intent === "proposal_strategy") {
    return buildSlackProposalStrategyReply(params);
  }

  if (intent === "notice_summary") {
    return buildSlackNoticeSummaryReply(params);
  }

  return buildSlackScoreReasonReply(params);
}

type SlackThreadReplyIntent = "score_reason" | "proposal_strategy" | "notice_summary";

function detectSlackThreadReplyIntent(questionText?: string): SlackThreadReplyIntent {
  const normalized = (questionText ?? "")
    .replace(/<@[A-Z0-9]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/제안|전략|공략|수주|참여|지원|리스크|위험|강점|포지션|대응|준비/.test(normalized)) {
    return "proposal_strategy";
  }

  if (/요약|정리|무슨\s*공고|뭐하는|내용|한줄|한\s*줄/.test(normalized)) {
    return "notice_summary";
  }

  return "score_reason";
}

function buildSlackScoreReasonReply(params: {
  itemIndex: number;
  notice: NoticeRecord;
}): string {
  const { itemIndex, notice } = params;
  const keywords = notice.matchedKeywords.join(", ") || "직접 매칭된 키워드 없음";
  const scoringRule = "현재 점수는 블루맵 핵심역량, 일반 IT/GIS, 과업 맥락, 참여 리스크를 함께 반영해 계산했습니다.";

  return [
    `*${itemIndex}번 공고는 적합도 ${notice.score}점입니다.*`,
    "",
    `- 매칭 키워드: ${escapeSlack(keywords)}`,
    `- 점수 근거: ${escapeSlack(notice.scoreReason || scoringRule)}`,
    `- 계산 기준: ${escapeSlack(scoringRule)}`,
    "",
    "자세한 공고 정보와 첨부파일 기반 분석은 웹 상세에서 확인하세요.",
    getNoticeDetailUrl(notice.id)
  ].join("\n");
}

function buildSlackProposalStrategyReply(params: {
  itemIndex: number;
  notice: NoticeRecord;
}): string {
  const { itemIndex, notice } = params;
  const keywords = notice.matchedKeywords.slice(0, 4).join(", ") || "직접 매칭된 키워드 없음";
  const focus = buildProposalFocus(notice);
  const caution = buildProposalCaution(notice);
  const nextAction =
    notice.hasAnalysisReport === true
      ? "웹 상세에 있는 기존 분석 메모를 기준으로 제안서 초안을 바로 다듬어보세요."
      : "공고문/과업지시서를 웹 상세에서 열어 실제 SW, 데이터, GIS 과업이 있는지 먼저 확인하세요.";

  return [
    `*${itemIndex}번 공고 제안 전략은 이렇게 잡는 게 좋겠습니다.*`,
    "",
    `- 포지션: ${escapeSlack(focus)}`,
    `- 강조 포인트: ${escapeSlack(keywords)} 키워드와 연결되는 구축/운영 경험을 앞에 배치하세요.`,
    `- 확인할 리스크: ${escapeSlack(caution)}`,
    `- 다음 액션: ${escapeSlack(nextAction)}`,
    "",
    "Slack에서는 핵심만 정리했습니다. 세부 제안 전략은 웹 상세에서 확인하세요.",
    getNoticeDetailUrl(notice.id)
  ].join("\n");
}

function buildSlackNoticeSummaryReply(params: {
  itemIndex: number;
  notice: NoticeRecord;
}): string {
  const { itemIndex, notice } = params;
  const keywords = notice.matchedKeywords.slice(0, 5).join(", ") || "직접 매칭된 키워드 없음";

  return [
    `*${itemIndex}번 공고 요약입니다.*`,
    "",
    `- 공고명: ${escapeSlack(notice.title)}`,
    `- 발주처: ${escapeSlack(notice.organization ?? "기관 미확인")}`,
    `- 마감: ${escapeSlack(formatDateLabel(notice.deadlineAt))}`,
    `- 적합도: ${notice.score}점`,
    `- 매칭 키워드: ${escapeSlack(keywords)}`,
    "",
    "상세 공고와 첨부파일 분석은 웹 상세에서 확인하세요.",
    getNoticeDetailUrl(notice.id)
  ].join("\n");
}

function buildProposalFocus(notice: NoticeRecord): string {
  const text = `${notice.title} ${notice.rawKeywordsText} ${notice.matchedKeywords.join(" ")}`;

  if (/GIS|공간정보|해양공간정보|S-100|지도|DB/.test(text)) {
    return "BLUEMAP의 GIS, 공간정보, 데이터 표준화 역량을 주 제안 축으로 잡으세요.";
  }

  if (/플랫폼|시스템|SW|소프트웨어|API|데이터/.test(text)) {
    return "플랫폼/시스템 구축 경험을 앞세우되, 블루맵 특화 역량과 직접 연결되는 데이터 과업을 찾아야 합니다.";
  }

  return "블루맵 핵심 역량과 직접 맞는 과업이 있는지 확인한 뒤, 단독 참여보다 협력 포지션을 먼저 검토하세요.";
}

function buildProposalCaution(notice: NoticeRecord): string {
  const text = `${notice.title} ${notice.rawKeywordsText}`;

  if (/건축|공사|전기|배수|정비|토목|구매/.test(text)) {
    return "공사/구매 중심이면 적합도는 키워드 때문에 잡힌 것일 수 있습니다. IT, 데이터, GIS 과업이 없으면 우선순위를 낮추세요.";
  }

  if (notice.score < 18) {
    return "점수가 낮은 편이라 단독 수주 후보보다는 과업 범위 확인 후 보조 참여 여부를 판단하는 게 좋습니다.";
  }

  return "첨부파일에서 평가 기준, 실적 요건, 과업 범위가 블루맵 경험과 맞는지 확인해야 합니다.";
}

export async function postSlackThreadReply(params: {
  channelId: string;
  threadTs: string;
  text: string;
}): Promise<SlackSendResult> {
  const payload = {
    text: params.text
  };

  return postSlackBotPayload(payload, "Slack 쓰레드에 답변했습니다.", {
    channelId: params.channelId,
    threadTs: params.threadTs
  });
}

async function postSlackPayload(payload: Record<string, unknown>, successMessage: string): Promise<SlackSendResult> {
  const botResult = await postSlackBotPayload(payload, successMessage);

  if (botResult.status !== "skipped") {
    return botResult;
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      status: "skipped",
      message: "SLACK_WEBHOOK_URL 또는 SLACK_BOT_TOKEN/SLACK_CHANNEL_ID가 없어 Slack 알림을 건너뜁니다."
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return {
      status: "failed",
      message: `Slack 알림 실패: HTTP ${response.status}`
    };
  }

  return {
    status: "sent",
    message: successMessage,
    transport: "webhook"
  };
}

async function postSlackBotPayload(
  payload: Record<string, unknown>,
  successMessage: string,
  options: {
    channelId?: string;
    threadTs?: string;
  } = {}
): Promise<SlackSendResult> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = options.channelId ?? process.env.SLACK_CHANNEL_ID;

  if (!botToken || !channelId) {
    return {
      status: "skipped",
      message: "SLACK_BOT_TOKEN 또는 SLACK_CHANNEL_ID가 없어 Slack Bot 알림을 건너뜁니다."
    };
  }

  const response = await fetch(SLACK_POST_MESSAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      channel: channelId,
      unfurl_links: false,
      unfurl_media: false,
      ...payload,
      ...(options.threadTs ? { thread_ts: options.threadTs } : {})
    })
  });

  if (!response.ok) {
    return {
      status: "failed",
      message: `Slack Bot 알림 실패: HTTP ${response.status}`,
      transport: "bot"
    };
  }

  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    channel?: string;
    ts?: string;
  };

  if (!body.ok) {
    return {
      status: "failed",
      message: `Slack Bot 알림 실패: ${body.error ?? "unknown_error"}`,
      transport: "bot"
    };
  }

  return {
    status: "sent",
    message: successMessage,
    channelId: body.channel ?? channelId,
    messageTs: body.ts,
    transport: "bot"
  };
}

function escapeSlack(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
