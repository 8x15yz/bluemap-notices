import { beforeEach, describe, expect, it, vi } from "vitest";
import { rescoreAllNotices } from "@/lib/repositories/rescore";
import { sendSlackDigest } from "@/lib/services/slack";

const queryMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: queryMock })
}));

vi.mock("@/lib/repositories/filter-rules", () => ({
  getActiveFilterRuleConfig: vi.fn().mockResolvedValue({
    includeKeywords: ["GIS", "해양", "공간정보"],
    itRelevantKeywords: [],
    nonItExclusionKeywords: []
  })
}));

vi.mock("@/lib/services/slack", () => ({
  sendSlackDigest: vi.fn()
}));

type SourceRow = {
  id: string;
  raw_keywords_text: string;
  score: number;
  matched_keywords: string[];
  is_active_candidate: boolean;
};

function mockNoticeRows(rows: SourceRow[]) {
  queryMock.mockImplementation((sql: string) => {
    if (sql.includes("ALTER TABLE")) {
      return Promise.resolve({});
    }
    if (sql.includes("FROM notices n")) {
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

function findUpdateCall(): [string, unknown[]] | undefined {
  return queryMock.mock.calls.find(
    (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UPDATE notice_scores")
  ) as [string, unknown[]] | undefined;
}

describe("rescoreAllNotices", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { bluemapRescoreColumnsEnsured?: boolean })
      .bluemapRescoreColumnsEnsured;
    queryMock.mockReset();
    vi.mocked(sendSlackDigest).mockReset();
  });

  it("rescores an old GIST notice (false GIS match) down to score 0 and deactivates it", async () => {
    mockNoticeRows([
      {
        id: "g2b_old-gist",
        raw_keywords_text: "GIST 연구장비통합관리시스템 유지보수 및 기능개선 사업",
        score: 40,
        matched_keywords: ["GIS"],
        is_active_candidate: true
      }
    ]);

    const summary = await rescoreAllNotices({ dryRun: false });

    expect(summary.totalNotices).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.deactivated).toBe(1);

    const updateCall = findUpdateCall();
    expect(updateCall).toBeDefined();
    const [, params] = updateCall!;
    expect(params[1]).toBe(0); // score
    expect(params[4]).toBe(false); // is_active_candidate
  });

  it("removes GIS from matchedKeywords once it is recognized as electrical switchgear noise", async () => {
    mockNoticeRows([
      {
        id: "g2b_old-electrical",
        raw_keywords_text: "변전소 154kV GIS설비 정비공사",
        score: 30,
        matched_keywords: ["GIS", "해양"],
        is_active_candidate: true
      }
    ]);

    await rescoreAllNotices({ dryRun: false });

    const [, params] = findUpdateCall()!;
    expect(params[2]).not.toContain("GIS");
    expect(params[1]).toBe(0);
  });

  it("does not write to the database in dryRun mode but still reports the projected change", async () => {
    mockNoticeRows([
      {
        id: "g2b_dry",
        raw_keywords_text: "GIST 연구장비통합관리시스템 유지보수",
        score: 40,
        matched_keywords: ["GIS"],
        is_active_candidate: true
      }
    ]);

    const summary = await rescoreAllNotices({ dryRun: true });

    expect(summary.dryRun).toBe(true);
    expect(summary.updated).toBe(1);
    expect(findUpdateCall()).toBeUndefined();
  });

  it("never sends Slack notifications or writes to slack_notifications while rescoring", async () => {
    mockNoticeRows([
      {
        id: "g2b_a",
        raw_keywords_text: "해양공간정보 GIS DB 구축 용역",
        score: 85,
        matched_keywords: ["GIS"],
        is_active_candidate: true
      }
    ]);

    await rescoreAllNotices({ dryRun: false });

    expect(sendSlackDigest).not.toHaveBeenCalled();
    const slackTableCalls = queryMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("slack_notifications")
    );
    expect(slackTableCalls).toHaveLength(0);
  });

  it("does not hard-delete notices (only issues SELECT/UPDATE/ALTER statements)", async () => {
    mockNoticeRows([
      {
        id: "g2b_b",
        raw_keywords_text: "GIST 연구장비통합관리시스템 유지보수",
        score: 40,
        matched_keywords: ["GIS"],
        is_active_candidate: true
      }
    ]);

    await rescoreAllNotices({ dryRun: false });

    const deleteCalls = queryMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && /\bDELETE\b/i.test(call[0])
    );
    expect(deleteCalls).toHaveLength(0);
  });
});
