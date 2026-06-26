import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/rescore-notices/route";
import { rescoreAllNotices, type RescoreSummary } from "@/lib/repositories/rescore";

vi.mock("@/lib/repositories/rescore", () => ({
  rescoreAllNotices: vi.fn()
}));

const rescoreAllNoticesMock = vi.mocked(rescoreAllNotices);

describe("/api/admin/rescore-notices route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 401 when neither ADMIN_SECRET nor CRON_SECRET is configured", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(createRequest({ headers: { authorization: "Bearer anything" } }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(rescoreAllNoticesMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token matches neither secret", async () => {
    vi.stubEnv("ADMIN_SECRET", "admin-secret");
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const response = await POST(createRequest({ headers: { authorization: "Bearer wrong" } }));

    expect(response.status).toBe(401);
    expect(rescoreAllNoticesMock).not.toHaveBeenCalled();
  });

  it("authorizes with ADMIN_SECRET", async () => {
    vi.stubEnv("ADMIN_SECRET", "admin-secret");
    vi.stubEnv("CRON_SECRET", "");
    rescoreAllNoticesMock.mockResolvedValueOnce(createSummary());

    const response = await POST(createRequest({ headers: { authorization: "Bearer admin-secret" } }));

    expect(response.status).toBe(200);
    expect(rescoreAllNoticesMock).toHaveBeenCalledWith({ dryRun: false });
  });

  it("falls back to CRON_SECRET when ADMIN_SECRET is unset", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    rescoreAllNoticesMock.mockResolvedValueOnce(createSummary());

    const response = await POST(createRequest({ headers: { authorization: "Bearer cron-secret" } }));

    expect(response.status).toBe(200);
    expect(rescoreAllNoticesMock).toHaveBeenCalledWith({ dryRun: false });
  });

  it("passes dryRun=true through to rescoreAllNotices", async () => {
    vi.stubEnv("ADMIN_SECRET", "admin-secret");
    rescoreAllNoticesMock.mockResolvedValueOnce(createSummary({ dryRun: true }));

    const response = await POST(
      createRequest({
        url: "http://localhost:3000/api/admin/rescore-notices?dryRun=true",
        headers: { authorization: "Bearer admin-secret" }
      })
    );

    expect(response.status).toBe(200);
    expect(rescoreAllNoticesMock).toHaveBeenCalledWith({ dryRun: true });
  });

  it("returns a readable error and logs failures", async () => {
    vi.stubEnv("ADMIN_SECRET", "admin-secret");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rescoreAllNoticesMock.mockRejectedValueOnce(new Error("재채점 실패"));

    const response = await POST(createRequest({ headers: { authorization: "Bearer admin-secret" } }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "재채점 실패" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[api/admin/rescore-notices] Rescore failed", expect.any(Error));
  });
});

function createRequest(
  init: { url?: string } & ConstructorParameters<typeof NextRequest>[1] = {}
): NextRequest {
  const { url, ...rest } = init;
  return new NextRequest(url ?? "http://localhost:3000/api/admin/rescore-notices", { method: "POST", ...rest });
}

function createSummary(overrides: Partial<RescoreSummary> = {}): RescoreSummary {
  return {
    dryRun: false,
    scoringVersion: "test-version",
    totalNotices: 0,
    updated: 0,
    activated: 0,
    deactivated: 0,
    ...overrides
  };
}
