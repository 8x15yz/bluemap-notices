import type { AnalysisReport, NoticeRecord, ProposalDraftMessage } from "@/lib/types";
import {
  buildBluemapCapabilityPromptContext,
  buildNoticeCapabilitySearchText,
  matchBluemapCapabilities,
  type MatchedBluemapCapability
} from "@/lib/bluemap-capabilities";
import { escapeMarkdownTableCell, normalizeExtractedTextLine } from "@/lib/utils/text-cleanup";
import { truncateText } from "@/lib/utils/text";
import { formatDateLabel } from "@/lib/utils/dates";

export type LlmProvider = "mock" | "openai" | "anthropic";

export interface StrategyMemoInput {
  notice: NoticeRecord;
  documentMarkdown: string;
}

export interface StrategyMemoResult {
  provider: LlmProvider;
  memo: string;
}

export interface ProposalDraftInput {
  notice: NoticeRecord;
  analysisReport: AnalysisReport;
}

export interface ProposalDraftRevisionInput extends ProposalDraftInput {
  currentDraft: string;
  messages: Pick<ProposalDraftMessage, "role" | "content">[];
  userMessage: string;
}

export interface ProposalDraftResult {
  provider: LlmProvider;
  contentMarkdown: string;
  assistantMessage: string;
}

export interface SlackThreadAnswerInput {
  itemIndex: number;
  notice: NoticeRecord;
  questionText: string;
  analysisReport?: AnalysisReport;
}

export interface SlackThreadAnswerResult {
  provider: LlmProvider;
  answer: string;
}

export async function generateStrategyMemo(input: StrategyMemoInput): Promise<StrategyMemoResult> {
  const provider = getProvider();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider,
      memo: await callOpenAi(input)
    };
  }

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return {
      provider,
      memo: await callAnthropic(input)
    };
  }

  return {
    provider: "mock",
    memo: buildMockMemo(input)
  };
}

export async function generateProposalDraft(input: ProposalDraftInput): Promise<ProposalDraftResult> {
  const provider = getProvider();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider,
      contentMarkdown: await callOpenAiWithPrompt(buildProposalDraftPrompt(input)),
      assistantMessage: "제안서 초안을 작성했습니다."
    };
  }

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return {
      provider,
      contentMarkdown: await callAnthropicWithPrompt(buildProposalDraftPrompt(input), 3600),
      assistantMessage: "제안서 초안을 작성했습니다."
    };
  }

  return buildMockProposalDraft(input);
}

export async function reviseProposalDraft(input: ProposalDraftRevisionInput): Promise<ProposalDraftResult> {
  const provider = getProvider();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider,
      contentMarkdown: await callOpenAiWithPrompt(buildProposalRevisionPrompt(input)),
      assistantMessage: "요청을 반영해 제안서 초안을 갱신했습니다."
    };
  }

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return {
      provider,
      contentMarkdown: await callAnthropicWithPrompt(buildProposalRevisionPrompt(input), 3600),
      assistantMessage: "요청을 반영해 제안서 초안을 갱신했습니다."
    };
  }

  return buildMockProposalRevision(input);
}

export async function generateSlackThreadAnswer(input: SlackThreadAnswerInput): Promise<SlackThreadAnswerResult> {
  const provider = getProvider();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    const answer = sanitizeSlackAnswer(await callOpenAiWithPrompt(buildSlackThreadAnswerPrompt(input)));

    return {
      provider,
      answer: answer || buildMockSlackThreadAnswer(input)
    };
  }

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const answer = sanitizeSlackAnswer(await callAnthropicWithPrompt(buildSlackThreadAnswerPrompt(input), 900));

    return {
      provider,
      answer: answer || buildMockSlackThreadAnswer(input)
    };
  }

  return {
    provider: "mock",
    answer: buildMockSlackThreadAnswer(input)
  };
}

function getProvider(): LlmProvider {
  const provider = process.env.AI_PROVIDER;

  if (provider === "openai" || provider === "anthropic") {
    return provider;
  }

  return "mock";
}

function buildSlackThreadAnswerPrompt(input: SlackThreadAnswerInput): string {
  const contextText = [
    input.notice.rawKeywordsText,
    input.notice.summary,
    input.analysisReport?.strategyMemo,
    input.analysisReport?.documentMarkdown
  ]
    .filter(Boolean)
    .join("\n\n");
  const bluemapCapabilityContext = buildBluemapCapabilityPromptContext(input.notice, contextText);

  return `
너는 블루맵(주)의 나라장터 공고 큐레이션 Slack 봇이다.
사용자가 Slack 스레드에서 묻는 질문에 한국어로 짧고 정확하게 답하라.

반드시 지킬 원칙:
- 아래 [공고 정보]와 [분석 메모] 안에서만 답한다.
- 모르는 내용은 추측하지 말고 "웹 상세에서 공고문/첨부파일 확인 필요"라고 쓴다.
- Slack 답변이므로 5~7줄 이내로 쓴다.
- 표, 긴 Markdown 제목, 코드블록, 과한 인사말은 쓰지 않는다.
- 일반 Markdown의 굵게 문법인 **텍스트**는 쓰지 않는다. 꼭 강조가 필요하면 Slack mrkdwn 형식인 *텍스트*만 쓴다.
- 단어마다 따옴표나 굵게를 넣지 말고, 짧은 문장과 bullet 중심으로 쓴다.
- 질문이 제안 전략/수주 가능성/리스크라면 포지션, 강점, 리스크, 다음 액션을 짧게 답한다.
- 질문이 점수 이유라면 점수, 매칭 키워드, 계산 근거를 짧게 답한다.
- 질문이 요약이라면 공고명, 발주처, 마감, 핵심 키워드를 짧게 답한다.
- BLUEMAP 역량과 연결할 때는 [블루맵 기술특장점 매칭]에 있는 내용만 근거로 쓴다.

[사용자 질문]
${truncateText(input.questionText, 1200)}

[공고 정보]
- Slack 번호: ${input.itemIndex}번
- 공고명: ${input.notice.title}
- 발주처/수요기관: ${input.notice.organization ?? "미확인"}
- 마감(한국시간): ${formatDeadlineForPrompt(input.notice.deadlineAt)}
- 예산/금액: ${formatNoticeBudgetForPrompt(input.notice)}
- 계약 방식: ${formatContractMethodForPrompt(input.notice)}
- 낙찰 방식: ${formatAwardMethodForPrompt(input.notice)}
- 적합도 점수: ${input.notice.score}점
- 매칭 키워드: ${input.notice.matchedKeywords.join(", ") || "직접 매칭된 키워드 없음"}
- 점수 근거: ${input.notice.scoreReason || "점수 근거 없음"}
- 공고 요약: ${input.notice.summary ?? "요약 없음"}
- 원문 키워드/검색 텍스트: ${truncateText(input.notice.rawKeywordsText, 1800)}
- 상세 메타데이터: ${formatNoticeMetadataForSlackPrompt(input.notice)}

[블루맵 기술특장점 매칭]
${bluemapCapabilityContext}

[분석 메모]
${formatSlackAnalysisContext(input.analysisReport)}
`.trim();
}

function buildProposalDraftPrompt(input: ProposalDraftInput): string {
  const bluemapCapabilityContext = buildBluemapCapabilityPromptContext(
    input.notice,
    `${input.analysisReport.strategyMemo}\n\n${input.analysisReport.documentMarkdown}`
  );

  return `
너는 블루맵(주)의 공공 입찰 제안서 작성 PM이다.
아래 나라장터 공고, 공고 분석, 제안요청서 Markdown, 블루맵 기술특장점 매칭을 바탕으로 제출 전 검토용 제안서 초안을 한국어 Markdown으로 작성하라.

반드시 지킬 원칙:
- 제안요청서에 있는 작성 양식, 목차, 제출서류, 평가 기준을 초안 구조에 우선 반영한다.
- 문서에 없는 항목은 단정하지 말고 "문서에서 확인 필요"라고 쓴다.
- 블루맵 기술특장점 매칭을 제안 배경, 수행 전략, 차별화 포인트, 산출물 설명에 반영한다.
- 공고 분석 메모는 판단 근거로 사용하되, 제안서 본문처럼 자연스럽게 다시 작성한다.
- 결과는 전체 제안서 초안 Markdown만 반환한다.
- DOCX/HWP 변환 지시, 시스템 설명, 작성 방법 설명은 쓰지 않는다.

[공고]
- 제목: ${input.notice.title}
- 기관: ${input.notice.organization ?? "미확인"}
- 마감(한국시간): ${formatDeadlineForPrompt(input.notice.deadlineAt)}
- 예산/금액: ${formatNoticeBudgetForPrompt(input.notice)}
- 계약 방식: ${formatContractMethodForPrompt(input.notice)}
- 낙찰 방식: ${formatAwardMethodForPrompt(input.notice)}
- 적합도 점수: ${input.notice.score}
- 매칭 키워드: ${input.notice.matchedKeywords.join(", ")}

[분석 기준 파일]
- 파일명: ${input.analysisReport.fileName}
- 분석 모델: ${input.analysisReport.modelProvider}

[블루맵 기술특장점 매칭]
${bluemapCapabilityContext}

[공고 분석 메모]
${truncateText(input.analysisReport.strategyMemo, 12000)}

[제안요청서 Markdown]
${truncateText(input.analysisReport.documentMarkdown, 28000)}

[기본 작성 형식]
# 제안서 초안

## 1. 제안 개요
## 2. 제안요청서 작성 양식 반영
## 3. 사업 이해 및 수행 전략
## 4. 블루맵 기술 적용 방안
## 5. 추진 일정 및 산출물
## 6. 평가 기준 대응 전략
## 7. 확인 필요 사항
`.trim();
}

function buildProposalRevisionPrompt(input: ProposalDraftRevisionInput): string {
  const bluemapCapabilityContext = buildBluemapCapabilityPromptContext(
    input.notice,
    `${input.analysisReport.strategyMemo}\n\n${input.analysisReport.documentMarkdown}`
  );

  return `
너는 블루맵(주)의 공공 입찰 제안서 작성 PM이다.
아래 기존 제안서 초안과 사용자의 수정 요청을 반영해 전체 제안서 초안을 다시 작성하라.

반드시 지킬 원칙:
- 결과는 수정 반영이 완료된 전체 제안서 초안 Markdown만 반환한다.
- 기존 초안의 좋은 구조는 유지하되, 사용자 요청이 명확하면 해당 내용을 본문에 반영한다.
- 제안요청서와 공고 분석에 없는 내용은 단정하지 말고 "문서에서 확인 필요"라고 쓴다.
- 블루맵 기술특장점 매칭에 근거한 표현을 유지한다.
- 수정 과정 설명이나 별도 답변문은 쓰지 않는다.

[공고]
- 제목: ${input.notice.title}
- 기관: ${input.notice.organization ?? "미확인"}
- 마감(한국시간): ${formatDeadlineForPrompt(input.notice.deadlineAt)}
- 예산/금액: ${formatNoticeBudgetForPrompt(input.notice)}
- 계약 방식: ${formatContractMethodForPrompt(input.notice)}
- 낙찰 방식: ${formatAwardMethodForPrompt(input.notice)}
- 적합도 점수: ${input.notice.score}

[분석 기준 파일]
- 파일명: ${input.analysisReport.fileName}

[블루맵 기술특장점 매칭]
${bluemapCapabilityContext}

[최근 대화]
${formatProposalConversation(input.messages)}

[기존 제안서 초안]
${truncateText(input.currentDraft, 22000)}

[사용자 수정 요청]
${truncateText(input.userMessage, 3000)}

[공고 분석 메모]
${truncateText(input.analysisReport.strategyMemo, 9000)}

[제안요청서 Markdown]
${truncateText(input.analysisReport.documentMarkdown, 18000)}
`.trim();
}

function buildPrompt(input: StrategyMemoInput): string {
  const bluemapCapabilityContext = buildBluemapCapabilityPromptContext(input.notice, input.documentMarkdown);

  return `
너는 블루맵(주)의 정부 입찰/제안 전략 담당자다.
아래 나라장터 공고, 첨부문서, 블루맵 기술특장점 매칭을 바탕으로 운영자가 바로 참여 여부를 판단하고 다음 행동을 정할 수 있는 공고 분석을 한국어 Markdown으로 작성하라.

반드시 지킬 원칙:
- 첨부문서에 없는 내용은 단정하지 말고 "문서에서 확인 필요"라고 쓴다.
- 블루맵 적합성, 발주 요구와 블루맵 대응 매핑, 제안 전략은 [블루맵 기술특장점 매칭]을 우선 근거로 작성한다.
- 블루맵 기술특장점 매칭에 없는 역량은 단정하지 말고 "추가 확인 필요" 또는 "문서에서 확인 필요"라고 쓴다.
- 발주기관 관점의 요구와 블루맵 관점의 대응 전략을 분리해서 쓴다.
- 날짜와 시간은 한국 시간(KST) 기준으로 작성한다.
- 예산/금액, 계약 방식, 낙찰 방식은 [공고] 값을 우선 사용하고, 첨부문서와 다르면 "추가 확인 필요"로 표시한다.
- 제안서에 바로 옮길 수 있는 표현을 2~3개 포함한다.
- 참가자격, 실적 제한, 공동수급, 납품/수행 범위, 마감 리스크를 우선 확인한다.
- 장황한 설명보다 의사결정에 필요한 bullet 중심으로 작성한다.
- "좋아 보인다" 같은 추상 표현 대신 어떤 조건이면 참여할지, 무엇을 확인해야 할지 쓴다.
- 각 전략 bullet에는 블루맵이 왜 유리한지 또는 무엇을 보완해야 하는지 근거를 붙인다.
- 참여 판단은 반드시 아래 5개 라벨 중 하나만 사용하고, 뒤에 "(적합도: ${input.notice.score}점)"을 붙인다.
  - 강력 권고: 적합도 80점 이상
  - 참여 권고
  - 조건부 검토
  - 낮은 우선순위
  - 참여 비권고
- 아래 작성 형식을 유지하고, 각 섹션에 빈 내용이 없게 한다.

[공고]
- 제목: ${input.notice.title}
- 기관: ${input.notice.organization ?? "미확인"}
- 마감(한국시간): ${formatDeadlineForPrompt(input.notice.deadlineAt)}
- 예산/금액: ${formatNoticeBudgetForPrompt(input.notice)}
- 계약 방식: ${formatContractMethodForPrompt(input.notice)}
- 낙찰 방식: ${formatAwardMethodForPrompt(input.notice)}
- 적합도 점수: ${input.notice.score}
- 매칭 키워드: ${input.notice.matchedKeywords.join(", ")}
- 공고 URL: ${input.notice.url}

[블루맵 기술특장점 매칭]
${bluemapCapabilityContext}

[첨부문서 Markdown]
${truncateText(input.documentMarkdown, 24000)}

[작성 형식]
## 1. 한 줄 판단
- 참여 판단: **<강력 권고|참여 권고|조건부 검토|낮은 우선순위|참여 비권고> (적합도: ${input.notice.score}점)**
- 핵심 이유:
- 우선순위:

## 2. 공고 핵심 요약
| 항목 | 내용 |
|---|---|
| 발주기관/수요기관 | |
| 과업 범위 | |
| 마감/일정(한국시간) | |
| 예산/금액 | |
| 계약 방식 | |
| 낙찰 방식 | |
| 제출물/산출물 | |

## 3. 블루맵 적합성
- 맞는 부분:
- 부족하거나 확인할 부분:
- 활용할 수 있는 레퍼런스/역량:

## 4. 발주 요구와 블루맵 대응 매핑
| 발주 요구/확인 항목 | 블루맵 대응 방향 | 근거/확인 필요 |
|---|---|---|
| 과업 범위 | | |
| 데이터/시스템 연계 | | |
| 자격/실적 | | |
| 산출물/검수 | | |

## 5. 제안 전략
- 제안 메시지:
- 기술 전략:
- 수행 전략:
- 차별화 포인트:

## 6. 리스크와 확인 질문
- 참가자격/실적:
- 일정/인력:
- 기술/데이터:
- 발주처에 확인할 질문:

## 7. 제안서 문장 후보
- 
- 
- 

## 8. 다음 액션
- [ ] 오늘 확인할 것:
- [ ] 담당자를 정할 것:
- [ ] 제안서 초안에 넣을 것:
`.trim();
}

async function callOpenAi(input: StrategyMemoInput): Promise<string> {
  return callOpenAiWithPrompt(buildPrompt(input));
}

async function callOpenAiWithPrompt(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API 오류: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  return payload.output_text || payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") || "";
}

async function callAnthropic(input: StrategyMemoInput): Promise<string> {
  return callAnthropicWithPrompt(buildPrompt(input), 1800);
}

async function callAnthropicWithPrompt(prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API 오류: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  return payload.content?.map((item) => item.text).filter(Boolean).join("\n") || "";
}

function sanitizeSlackAnswer(answer: string): string {
  return truncateText(
    answer
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
      .replace(/__([^_\n]+)__/g, "*$1*")
      .replace(/`([^`\n]+)`/g, "$1")
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    1600
  );
}

function formatNoticeMetadataForSlackPrompt(notice: NoticeRecord): string {
  const detail = getNoticeDetailRecord(notice);

  if (!detail) {
    return "상세 메타데이터 없음";
  }

  const keys = [
    "contractMethod",
    "awardMethod",
    "winnerMethod",
    "assignedBudget",
    "estimatedPrice",
    "demandAgency",
    "bidMethod",
    "bidType",
    "attachments"
  ];
  const lines = keys
    .map((key) => {
      const value = detail[key];

      if (value === undefined || value === null || value === "") {
        return null;
      }

      return `- ${key}: ${truncateText(JSON.stringify(value), 600)}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : "상세 메타데이터 없음";
}

function formatSlackAnalysisContext(analysisReport?: AnalysisReport): string {
  if (!analysisReport) {
    return "아직 웹 상세에서 첨부파일 기반 분석이 생성되지 않았습니다.";
  }

  return `
- 분석 파일: ${analysisReport.fileName}
- 분석 모델: ${analysisReport.modelProvider}

[공고 분석 메모]
${truncateText(analysisReport.strategyMemo, 5000)}

[첨부문서 발췌]
${truncateText(analysisReport.documentMarkdown, 5000)}
`.trim();
}

function buildMockMemo(input: StrategyMemoInput): string {
  const keywords = input.notice.matchedKeywords.slice(0, 8).join(", ") || "키워드 없음";
  const decision = formatDecisionLabel(input.notice.score);
  const documentSignals = extractDocumentSignals(input.documentMarkdown);
  const capabilityMatches = matchBluemapCapabilities(buildNoticeCapabilitySearchText(input.notice, input.documentMarkdown), 4);
  const capabilityTitles = formatCapabilityTitles(capabilityMatches);
  const capabilityStrengths = formatCapabilityStrengths(capabilityMatches);
  const primaryCapability = capabilityMatches[0];
  const proposalSentences = buildProposalSentences(documentSignals, capabilityMatches);

  return `
## 1. 한 줄 판단
- 참여 판단: **${decision}**
- 핵심 이유: 공고명/첨부문서가 ${keywords} 키워드와 연결되어 있으며, 블루맵 기술특장점 기준으로 ${capabilityTitles} 역량을 제안 근거로 검토할 수 있습니다.
- 우선순위: 적합도 ${input.notice.score}점 기준으로 참가자격과 과업 범위를 먼저 확인한 뒤 제안 여부를 확정하는 흐름이 적절합니다.

## 2. 공고 핵심 요약
| 항목 | 내용 |
|---|---|
| 발주기관/수요기관 | ${escapeMarkdownTableCell(input.notice.organization ?? "문서에서 확인 필요")} |
| 과업 범위 | ${escapeMarkdownTableCell(documentSignals.scope)} |
| 마감/일정(한국시간) | ${escapeMarkdownTableCell(formatDeadlineForPrompt(input.notice.deadlineAt, documentSignals.schedule))} |
| 예산/금액 | ${escapeMarkdownTableCell(formatNoticeBudgetForPrompt(input.notice))} |
| 계약 방식 | ${escapeMarkdownTableCell(formatContractMethodForPrompt(input.notice))} |
| 낙찰 방식 | ${escapeMarkdownTableCell(formatAwardMethodForPrompt(input.notice))} |
| 제출물/산출물 | ${escapeMarkdownTableCell(documentSignals.deliverable)} |

## 3. 블루맵 적합성
- 맞는 부분: ${capabilityTitles} 항목이 공고/첨부문서 신호와 연결됩니다.
- 부족하거나 확인할 부분: ${documentSignals.eligibility} 항목을 기준으로 실제 참가자격, 필수 실적, 소프트웨어사업자/정보통신공사업 등 등록 요건을 재확인해야 합니다.
- 활용할 수 있는 역량: ${capabilityStrengths}

## 4. 발주 요구와 블루맵 대응 매핑
| 발주 요구/확인 항목 | 블루맵 대응 방향 | 근거/확인 필요 |
|---|---|---|
| 과업 범위 | ${escapeMarkdownTableCell(primaryCapability?.proposalAngles[0] ?? "기능, 데이터, 인프라, 운영지원으로 쪼개 담당 가능 영역을 표시합니다.")} | ${escapeMarkdownTableCell(documentSignals.scope)} |
| 데이터/시스템 연계 | ${escapeMarkdownTableCell(buildCapabilityMappingDirection(capabilityMatches))} | ${escapeMarkdownTableCell(documentSignals.data)} |
| 자격/실적 | 유사 공공 정보시스템, 공간정보, 해양 도메인 실적을 우선 매칭합니다. | ${escapeMarkdownTableCell(documentSignals.eligibility)} |
| 산출물/검수 | 산출물 목록을 제안서 목차와 일정표에 그대로 반영합니다. | ${escapeMarkdownTableCell(documentSignals.deliverable)} |

## 5. 제안 전략
- 제안 메시지: "${buildProposalMessage(capabilityMatches)}"를 전면에 둡니다.
- 기술 전략: ${buildTechnicalStrategy(capabilityMatches)}
- 수행 전략: 착수 초기에 현행 데이터와 사용자 업무를 진단하고, 중간 산출물로 화면 흐름과 데이터 모델을 빠르게 검증하는 방식을 제안합니다.
- 차별화 포인트: ${buildDifferentiators(capabilityMatches)}

## 6. 리스크와 확인 질문
- 참가자격/실적: ${documentSignals.eligibility}
- 일정/인력: 마감일과 질의응답 일정을 기준으로 제안서 작성 가능 시간을 먼저 계산해야 합니다.
- 기술/데이터: 원천 데이터 제공 방식, 외부 시스템 연계 범위, 보안/망분리 조건이 있으면 비용과 일정에 직접 영향을 줍니다.
- 평가/검수: ${documentSignals.evaluation}
- 발주처에 확인할 질문: 기존 시스템/데이터의 제공 범위, 필수 연계 시스템, 운영자 수, 검수 기준, 산출물 양식을 확인해야 합니다.

## 7. 제안서 문장 후보
- ${proposalSentences[0]}
- ${proposalSentences[1]}
- ${proposalSentences[2]}

## 8. 다음 액션
- [ ] 첨부문서에서 참가자격, 필수 실적, 공동수급 허용 여부를 먼저 확인합니다.
- [ ] 과업 범위를 기능/데이터/인프라/운영지원으로 나누어 블루맵 담당 가능 영역을 표시합니다.
- [ ] 제안서 초안에 넣을 차별화 문장 2~3개와 예상 리스크 질문 목록을 정리합니다.
`.trim();
}

function buildMockSlackThreadAnswer(input: SlackThreadAnswerInput): string {
  const normalizedQuestion = normalizeExtractedTextLine(input.questionText);
  const keywords = input.notice.matchedKeywords.slice(0, 5).join(", ") || "직접 매칭된 키워드 없음";
  const capabilities = matchBluemapCapabilities(
    buildNoticeCapabilitySearchText(
      input.notice,
      `${input.analysisReport?.strategyMemo ?? ""}\n${input.analysisReport?.documentMarkdown ?? ""}`
    ),
    2
  );
  const capabilityTitles = formatCapabilityTitles(capabilities);

  if (/제안|전략|공략|수주|참여|지원|리스크|위험|강점|포지션|대응|준비/.test(normalizedQuestion)) {
    return [
      `*${input.itemIndex}번 공고는 ${getDecisionLabel(input.notice.score)} 후보로 보는 게 좋습니다.*`,
      `- 포지션: ${capabilityTitles} 역량과 연결되는 과업이 있는지 먼저 확인하세요.`,
      `- 강조 포인트: ${keywords} 키워드를 블루맵 구축/운영 경험과 연결합니다.`,
      "- 리스크: 공고문/첨부파일에서 참가자격, 실적, 실제 IT/GIS 과업 범위를 확인해야 합니다.",
      "- 다음 액션: 웹 상세에서 첨부파일 분석을 돌린 뒤 제안서 초안으로 넘기세요."
    ].join("\n");
  }

  if (/요약|정리|무슨\s*공고|뭐하는|내용|한줄|한\s*줄/.test(normalizedQuestion)) {
    return [
      `*${input.itemIndex}번 공고 요약입니다.*`,
      `- 공고명: ${input.notice.title}`,
      `- 발주처: ${input.notice.organization ?? "기관 미확인"}`,
      `- 마감: ${formatDeadlineForPrompt(input.notice.deadlineAt)}`,
      `- 적합도/키워드: ${input.notice.score}점 / ${keywords}`
    ].join("\n");
  }

  return [
    `*${input.itemIndex}번 공고는 적합도 ${input.notice.score}점입니다.*`,
    `- 매칭 키워드: ${keywords}`,
    `- 점수 근거: ${input.notice.scoreReason || "현재 점수는 블루맵 핵심역량, 일반 IT/GIS, 과업 맥락, 참여 리스크 기준으로 계산됐습니다."}`,
    "- 확인 필요: 상세 공고와 첨부파일에서 실제 과업 범위와 참가자격을 확인하세요."
  ].join("\n");
}

function buildMockProposalDraft(input: ProposalDraftInput): ProposalDraftResult {
  const documentSignals = extractDocumentSignals(input.analysisReport.documentMarkdown);
  const proposalGuide = extractProposalGuideSignals(input.analysisReport.documentMarkdown);
  const capabilityMatches = matchBluemapCapabilities(
    buildNoticeCapabilitySearchText(input.notice, input.analysisReport.documentMarkdown),
    4
  );
  const capabilityTitles = formatCapabilityTitles(capabilityMatches);
  const primaryCapability = capabilityMatches[0];
  const contentMarkdown = `
# 제안서 초안

## 1. 제안 개요
- 사업명: ${input.notice.title}
- 발주기관/수요기관: ${input.notice.organization ?? "문서에서 확인 필요"}
- 제안 방향: 제안요청서의 과업 범위와 평가 기준을 기준으로 ${capabilityTitles} 역량을 전면에 배치합니다.
- 블루맵 핵심 메시지: "${buildProposalMessage(capabilityMatches)}"

## 2. 제안요청서 작성 양식 반영
| 구분 | 문서 기준 | 초안 반영 |
|---|---|---|
| 작성 양식/목차 | ${escapeMarkdownTableCell(proposalGuide.format)} | 제안 개요, 사업 이해, 수행 전략, 기술 적용, 산출물, 평가 대응 순서로 구성합니다. |
| 제출서류/산출물 | ${escapeMarkdownTableCell(proposalGuide.documents)} | 산출물과 제출 문서는 일정표와 검수 기준에 함께 배치합니다. |
| 평가 기준 | ${escapeMarkdownTableCell(proposalGuide.evaluation)} | 기술능력, 수행 경험, 사업 이해도, 산출물 품질 중심으로 대응 문장을 작성합니다. |
| 일정/제출 | ${escapeMarkdownTableCell(proposalGuide.submission)} | 마감일과 질의응답 일정을 기준으로 초안 보완 우선순위를 정합니다. |

## 3. 사업 이해 및 수행 전략
- 과업 이해: ${documentSignals.scope}
- 데이터/시스템 이해: ${documentSignals.data}
- 수행 전략: 착수 단계에서 요구사항과 원천 데이터를 정리하고, 중간 산출물로 화면 흐름과 데이터 모델을 빠르게 검증합니다.
- 운영 전략: 발주기관 담당자가 지속적으로 관리할 수 있도록 데이터 구조, 검증 절차, 운영 화면을 함께 제안합니다.

## 4. 블루맵 기술 적용 방안
- 적용 역량: ${capabilityTitles}
- 기술 적용: ${buildTechnicalStrategy(capabilityMatches)}
- 차별화 포인트: ${buildDifferentiators(capabilityMatches)}
- 핵심 근거: ${primaryCapability?.strengths[0] ?? "공간정보/데이터 처리/정보시스템 구축 경험을 기준으로 문서 확인이 필요합니다."}

## 5. 추진 일정 및 산출물
| 단계 | 주요 작업 | 산출물 |
|---|---|---|
| 착수 | 요구사항, 데이터, 시스템 연계 범위 확인 | 착수보고서, 요구사항 정의 |
| 설계 | 데이터 구조, 화면 흐름, 검증 기준 설계 | 설계서, 데이터 모델, 화면 정의 |
| 구축 | 기능 구현, 데이터 구축/정제, 연계 검증 | 구축 결과물, 테스트 결과 |
| 검수 | 산출물 정리, 운영자 확인, 보완 | 완료보고서, 운영 매뉴얼 |

## 6. 평가 기준 대응 전략
- 기술능력: ${buildCapabilityMappingDirection(capabilityMatches)}
- 사업 이해도: ${documentSignals.scope}에 대한 이해를 업무 흐름과 산출물 구조로 설명합니다.
- 수행 안정성: 일정, 인력, 품질관리, 리스크 대응을 단계별로 제시합니다.
- 검수 대응: ${documentSignals.deliverable}

## 7. 확인 필요 사항
- 참가자격/실적: ${documentSignals.eligibility}
- 발주처 확인 질문: 기존 데이터 제공 범위, 필수 연계 시스템, 평가 배점 세부 기준, 산출물 양식을 확인해야 합니다.
- 내부 보완 사항: 유사 실적, 투입 인력, 일정표, 견적 범위를 제안 마감 전 확정해야 합니다.
`.trim();

  return {
    provider: "mock",
    contentMarkdown,
    assistantMessage: "제안서 초안을 작성했습니다."
  };
}

function buildMockProposalRevision(input: ProposalDraftRevisionInput): ProposalDraftResult {
  const request = normalizeExtractedTextLine(input.userMessage) || "수정 요청";
  const contentMarkdown = `
${input.currentDraft.trim()}

## 수정 반영 메모
- 수정 요청: ${request}
- 반영 방향: 위 제안서 초안의 사업 이해, 블루맵 기술 적용, 평가 기준 대응 문장에 요청사항을 반영해 보완합니다.
- 기준 분석 파일: ${input.analysisReport.fileName}
`.trim();

  return {
    provider: "mock",
    contentMarkdown,
    assistantMessage: "요청을 반영해 제안서 초안을 갱신했습니다."
  };
}

function formatProposalConversation(messages: Pick<ProposalDraftMessage, "role" | "content">[]): string {
  if (messages.length === 0) {
    return "대화 없음";
  }

  return messages
    .slice(-8)
    .map((message) => `- ${message.role}: ${truncateText(message.content, 1200)}`)
    .join("\n");
}

function extractProposalGuideSignals(markdown: string): {
  format: string;
  documents: string;
  evaluation: string;
  submission: string;
} {
  return {
    format:
      findRelevantLine(markdown, ["제안서 작성", "제안서 목차", "작성방법", "작성 방법", "목차", "제안서는"]) ??
      "문서에서 확인 필요",
    documents:
      findRelevantLine(markdown, ["제출서류", "제출 서류", "산출물", "제출물", "구비서류", "별지"]) ??
      "문서에서 확인 필요",
    evaluation:
      findRelevantLine(markdown, ["평가항목", "평가 항목", "평가기준", "평가 기준", "배점", "기술능력평가"]) ??
      "문서에서 확인 필요",
    submission:
      findRelevantLine(markdown, ["제출기한", "제출 기한", "제출일", "마감", "질의", "제출 방법"]) ??
      "문서에서 확인 필요"
  };
}

function formatDecisionLabel(score: number): string {
  return `${getDecisionLabel(score)} (적합도: ${score}점)`;
}

function getDecisionLabel(score: number): string {
  if (score >= 80) {
    return "강력 권고";
  }

  if (score >= 60) {
    return "참여 권고";
  }

  if (score >= 36) {
    return "조건부 검토";
  }

  if (score > 0) {
    return "낮은 우선순위";
  }

  return "참여 비권고";
}

function extractDocumentSignals(markdown: string): {
  eligibility: string;
  scope: string;
  deliverable: string;
  schedule: string;
  data: string;
  evaluation: string;
} {
  return {
    eligibility: findRelevantLine(markdown, ["참가자격", "입찰참가", "자격", "실적", "공동수급"]) ?? "문서에서 확인 필요",
    scope: findRelevantLine(markdown, ["과업", "사업내용", "수행범위", "구축", "개발", "용역"]) ?? "문서에서 확인 필요",
    deliverable: findRelevantLine(markdown, ["산출물", "제출물", "보고서", "납품", "검수"]) ?? "문서에서 확인 필요",
    schedule: findRelevantLine(markdown, ["마감", "제출기한", "착수", "완료", "기간", "일정"]) ?? "문서에서 확인 필요",
    data: findRelevantLine(markdown, ["데이터", "API", "연계", "시스템", "DB", "인터페이스"]) ?? "문서에서 확인 필요",
    evaluation: findRelevantLine(markdown, ["평가", "배점", "검수", "협상", "기술능력", "가격"]) ?? "문서에서 확인 필요"
  };
}

function findRelevantLine(markdown: string, keywords: string[]): string | undefined {
  const lines = markdown
    .split(/\r?\n/)
    .map(cleanMarkdownLine)
    .filter((line) => line.length >= 6 && line.length <= 220);

  return lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
}

function cleanMarkdownLine(line: string): string {
  return normalizeExtractedTextLine(line)
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[\).\s]+/, "")
    .trim();
}

function formatDeadlineForPrompt(value?: string, fallback = "문서에서 확인 필요"): string {
  if (!value) {
    return fallback;
  }

  return `${formatDateLabel(value)} (KST)`;
}

function formatNoticeBudgetForPrompt(notice: NoticeRecord): string {
  const parts: string[] = [];
  const knownValues: number[] = [];
  addBudgetPart(parts, knownValues, "공고 예산", notice.budgetAmount);
  addBudgetPart(parts, knownValues, "배정 예산", getNoticeDetailNumber(notice, "assignedBudget"));
  addBudgetPart(parts, knownValues, "추정 가격", getNoticeDetailNumber(notice, "estimatedPrice"));

  return parts.length > 0 ? parts.join(" / ") : "문서에서 확인 필요";
}

function addBudgetPart(parts: string[], knownValues: number[], label: string, value?: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || knownValues.includes(value)) {
    return;
  }

  knownValues.push(value);
  parts.push(`${label} ${formatWon(value)}`);
}

function formatContractMethodForPrompt(notice: NoticeRecord): string {
  return getNoticeDetailString(notice, "contractMethod") ?? getNoticeMetadataString(notice, "contractMethod") ?? "문서에서 확인 필요";
}

function formatAwardMethodForPrompt(notice: NoticeRecord): string {
  return (
    getNoticeDetailString(notice, "awardMethod") ??
    getNoticeMetadataString(notice, "winnerMethod") ??
    getNoticeMetadataString(notice, "awardMethod") ??
    "문서에서 확인 필요"
  );
}

function getNoticeDetailString(notice: NoticeRecord, key: string): string | undefined {
  const value = getNoticeDetailRecord(notice)?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNoticeMetadataString(notice: NoticeRecord, key: string): string | undefined {
  const value = notice.metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNoticeDetailNumber(notice: NoticeRecord, key: string): number | undefined {
  const value = getNoticeDetailRecord(notice)?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getNoticeDetailRecord(notice: NoticeRecord): Record<string, unknown> | undefined {
  const detail = notice.metadata.detail;

  return detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as Record<string, unknown>) : undefined;
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatCapabilityTitles(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "공간정보/데이터 처리/정보시스템 구축";
  }

  return capabilities.map((capability) => capability.title).join(", ");
}

function formatCapabilityStrengths(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "공간데이터 모델링, 운영자 화면 설계, 데이터 연계 API, 관제/모니터링 UX, 공공기관 정보시스템 구축 경험을 제안서의 근거로 배치합니다.";
  }

  return capabilities
    .slice(0, 3)
    .map((capability) => `${capability.title}: ${capability.strengths[0]}`)
    .join(" / ");
}

function buildCapabilityMappingDirection(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "API, 데이터 모델, 운영 화면을 한 흐름으로 설계하는 방안을 제시합니다.";
  }

  return `${capabilities[0].title}을 중심으로 데이터 모델, 연계 API, 운영 화면, 검증 절차를 한 흐름으로 제시합니다.`;
}

function buildProposalMessage(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "단순 시스템 구축이 아니라, 발주기관이 계속 운영할 수 있는 데이터 구조와 업무 흐름을 함께 설계한다";
  }

  return `${capabilities[0].title}을 기반으로 발주 요구를 표준 데이터, 운영 화면, 검증 가능한 산출물로 연결한다`;
}

function buildTechnicalStrategy(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "요구 기능을 데이터 수집/정제, 표준화, API 연계, 시각화, 운영 모니터링으로 나누어 블루맵 담당 역량과 매핑합니다.";
  }

  return capabilities
    .slice(0, 3)
    .map((capability) => capability.proposalAngles[0])
    .join(" ");
}

function buildDifferentiators(capabilities: MatchedBluemapCapability[]): string {
  if (capabilities.length === 0) {
    return "해양/공간정보 도메인 이해, 표준 기반 데이터 설계, 운영자 친화적 화면, 향후 확장 가능한 API 구조를 강조합니다.";
  }

  return capabilities
    .slice(0, 3)
    .map((capability) => capability.evidence[0])
    .join(", ");
}

function buildProposalSentences(signals: ReturnType<typeof extractDocumentSignals>, capabilities: MatchedBluemapCapability[]): string[] {
  const primaryCapability = capabilities[0]?.title ?? "해양·공간정보 시스템 구축 역량";
  const primaryStrength = capabilities[0]?.strengths[0] ?? "데이터 구조, 사용자 업무 흐름, 운영 화면을 함께 설계하는 경험";

  return [
    `블루맵은 ${primaryCapability}을 바탕으로 ${signals.scope}에 대해 데이터 구조, 사용자 업무 흐름, 운영 화면을 함께 설계해 발주기관의 지속 운영 부담을 낮추겠습니다.`,
    `본 과업은 ${signals.data}를 안정적으로 연결하는 것이 중요하므로, ${primaryStrength}을 중심으로 표준화된 데이터 모델과 단계별 검증 체계를 수행하겠습니다.`,
    `검수와 산출물은 ${signals.deliverable} 기준을 제안 일정표에 반영하고, 블루맵의 기술특장점과 연결되는 중간 결과물을 착수 초기부터 확인 가능하게 제시하겠습니다.`
  ];
}
