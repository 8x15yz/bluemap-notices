import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSlackDigestPayload,
  buildSlackPayload,
  buildSlackThreadReply,
  getNoticeDetailUrl,
  getSlackDigestItems,
  sendSlackDigest
} from "@/lib/services/slack";
import type { NoticeRecord } from "@/lib/types";

describe("slack", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("builds a web detail URL", () => {
    vi.stubEnv("APP_BASE_URL", "https://bluemap.example.com");

    expect(getNoticeDetailUrl("g2b_R25BK00933743_000")).toBe(
      "https://bluemap.example.com/notices/g2b_R25BK00933743_000"
    );

  });

  it("includes score, keywords, and detail action in a single notice payload", () => {
    vi.stubEnv("APP_BASE_URL", "https://bluemap.example.com");

    const payload = buildSlackPayload(
      createNotice({
        title: "해양공간정보 GIS 플랫폼 고도화 용역",
        organization: "해양수산부",
        matchedKeywords: ["해양공간정보", "GIS", "플랫폼"],
        score: 36,
        scoreReason: "해양공간정보, GIS, 플랫폼 키워드가 공고 내용과 맞습니다."
      })
    );

    const json = JSON.stringify(payload);

    expect(json).toContain("36");
    expect(json).toContain("해양공간정보");
    expect(json).toContain("https://bluemap.example.com/notices/g2b_R25BK00933743_000");

  });

  it("builds one digest payload for multiple candidate notices", () => {
    vi.stubEnv("APP_BASE_URL", "https://bluemap.example.com");

    const payload = buildSlackDigestPayload([
      createNotice({
        id: "g2b_R25BK00933743_000",
        title: "해양공간정보 GIS 플랫폼 고도화 용역",
        organization: "해양수산부",
        matchedKeywords: ["해양공간정보", "GIS", "플랫폼"],
        score: 36
      }),
      createNotice({
        id: "g2b_R26BK01579240_000",
        title: "메타데이터 기반의 보건의료데이터 중개 포털 시스템 구축",
        organization: "한국보건의료정보원",
        matchedKeywords: ["데이터 모델링", "플랫폼"],
        score: 24
      })
    ]);

    const json = JSON.stringify(payload);

    expect(payload.text).toBe("나라장터 후보 공고 2건");
    expect(json).toContain("해양공간정보 GIS 플랫폼 고도화 용역");
    expect(json).toContain("메타데이터 기반의 보건의료데이터 중개 포털 시스템 구축");
    expect(json).toContain("웹에서 전체 보기");
    expect(json).toContain("https://bluemap.example.com/notices/g2b_R25BK00933743_000");
    expect(json).toContain("https://bluemap.example.com/notices/g2b_R26BK01579240_000");

  });

  it("keeps digest item numbering to the visible Slack items", () => {
    const notices = Array.from({ length: 12 }, (_, index) =>
      createNotice({
        id: `notice-${index + 1}`
      })
    );

    expect(getSlackDigestItems(notices)).toHaveLength(10);
    expect(getSlackDigestItems(notices)[9].id).toBe("notice-10");
  });

  it("posts digest through Slack Bot when bot env is configured", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    vi.stubEnv("SLACK_CHANNEL_ID", "C123");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          channel: "C123",
          ts: "1718000000.000100"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSlackDigest([createNotice()]);

    expect(result).toMatchObject({
      status: "sent",
      channelId: "C123",
      messageTs: "1718000000.000100",
      transport: "bot"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xoxb-test"
        })
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      channel: "C123",
      unfurl_links: false,
      unfurl_media: false
    });
  });

  it("builds a concise thread reply for a numbered notice", () => {
    vi.stubEnv("APP_BASE_URL", "https://bluemap.example.com");

    const reply = buildSlackThreadReply({
      itemIndex: 3,
      notice: createNotice({
        id: "g2b_R26BK01579240_000",
        matchedKeywords: ["GIS"],
        score: 8,
        scoreReason: "일반기술 8점(GIS) 기준으로 적합도 8점에서 리스크 0점을 반영했습니다."
      })
    });

    expect(reply).toContain("3번 공고는 적합도 8점입니다.");
    expect(reply).toContain("매칭 키워드: GIS");
    expect(reply).toContain("일반기술 8점(GIS)");
    expect(reply).toContain("블루맵 핵심역량, 일반 IT/GIS, 과업 맥락, 참여 리스크");
    expect(reply).not.toContain("매칭 키워드 1개 기준");
    expect(reply).toContain("https://bluemap.example.com/notices/g2b_R26BK01579240_000");
  });

  it("builds a proposal strategy reply when the thread asks for strategy", () => {
    vi.stubEnv("APP_BASE_URL", "https://bluemap.example.com");

    const reply = buildSlackThreadReply({
      itemIndex: 2,
      questionText: "2번 공고의 제안 전략에 대해서 알려줘",
      notice: createNotice({
        id: "g2b_R26BK01583151_000",
        title: "학천지구 복합플랫폼 구축사업(건축공사)",
        rawKeywordsText: "복합플랫폼 건축공사",
        matchedKeywords: ["플랫폼", "건축공사", "공사"],
        score: 0,
        scoreReason: "일반기술 4점(플랫폼), 리스크 -13점(건축공사, 공사) 기준으로 적합도 4점에서 리스크 13점을 반영했습니다."
      })
    });

    expect(reply).toContain("2번 공고 제안 전략");
    expect(reply).toContain("포지션");
    expect(reply).toContain("확인할 리스크");
    expect(reply).toContain("공사/구매 중심이면");
    expect(reply).toContain("https://bluemap.example.com/notices/g2b_R26BK01583151_000");
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
    category: "bid",
    rawKeywordsText: "해양공간정보 GIS 플랫폼",
    matchedKeywords: ["해양공간정보", "GIS", "플랫폼"],
    score: 36,
    scoreReason: "해양공간정보, GIS, 플랫폼 키워드가 공고 내용과 맞습니다.",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slackNotified: false,
    ...overrides
  };
}
