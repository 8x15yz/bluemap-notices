import { beforeEach, describe, expect, it, vi } from "vitest";
import { listNotices } from "@/lib/repositories/notices";

const queryMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: queryMock })
}));

vi.mock("@/lib/repositories/filter-rules", () => ({
  getActiveFilterRuleConfig: vi.fn().mockResolvedValue({
    includeKeywords: [],
    itRelevantKeywords: [],
    nonItExclusionKeywords: []
  })
}));

type NoticeRowFixture = {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  url: string;
  published_at: Date | null;
  deadline_at: Date | null;
  organization: string | null;
  budget_amount: string | null;
  category: string;
  summary: string | null;
  raw_keywords_text: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  score: number;
  matched_keywords: string[];
  reason: string;
  slack_notified: boolean;
  has_analysis_report: boolean;
  is_active_candidate: boolean;
};

function buildRow(overrides: Partial<NoticeRowFixture>): NoticeRowFixture {
  return {
    id: "g2b_1",
    source_id: "g2b",
    external_id: "1",
    title: "테스트 공고",
    url: "https://www.g2b.go.kr",
    published_at: new Date("2026-06-01T00:00:00.000Z"),
    deadline_at: new Date("2026-07-01T00:00:00.000Z"),
    organization: "테스트기관",
    budget_amount: null,
    category: "bid",
    summary: null,
    raw_keywords_text: "해양 GIS",
    metadata: {},
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
    score: 50,
    matched_keywords: ["해양", "GIS"],
    reason: "테스트",
    slack_notified: false,
    has_analysis_report: false,
    is_active_candidate: true,
    ...overrides
  };
}

function mockNoticeRows(rows: NoticeRowFixture[]) {
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

describe("listNotices", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { bluemapRescoreColumnsEnsured?: boolean })
      .bluemapRescoreColumnsEnsured;
    queryMock.mockReset();
  });

  it("does not return notices marked inactive by a rescore", async () => {
    mockNoticeRows([
      buildRow({ id: "g2b_active", is_active_candidate: true }),
      buildRow({ id: "g2b_inactive", is_active_candidate: false })
    ]);

    const notices = await listNotices();

    expect(notices.map((notice) => notice.id)).toEqual(["g2b_active"]);
  });

  it("returns active candidates as usual", async () => {
    mockNoticeRows([buildRow({ id: "g2b_active", is_active_candidate: true })]);

    const notices = await listNotices();

    expect(notices).toHaveLength(1);
    expect(notices[0].isActiveCandidate).toBe(true);
  });
});
