import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/sync/route";
import { syncG2bNotices } from "@/lib/services/sync";
import type { SyncSummary } from "@/lib/types";

vi.mock("@/lib/services/sync", () => ({
  syncG2bNotices: vi.fn()
}));

const syncG2bNoticesMock = vi.mocked(syncG2bNotices);

describe("/api/sync route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("runs without authorization when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const summary = createSummary();
    syncG2bNoticesMock.mockResolvedValueOnce(summary);

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(syncG2bNoticesMock).toHaveBeenCalledTimes(1);
  });

  it("blocks unauthenticated cron calls when CRON_SECRET is set", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(syncG2bNoticesMock).not.toHaveBeenCalled();
  });

  it("accepts a matching bearer token when CRON_SECRET is set", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const summary = createSummary({ fetched: 12, candidates: 3, stored: 3, notified: 3 });
    syncG2bNoticesMock.mockResolvedValueOnce(summary);

    const response = await POST(
      createRequest({
        method: "POST",
        headers: {
          authorization: "Bearer test-cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(syncG2bNoticesMock).toHaveBeenCalledTimes(1);
  });

  it("returns a readable error and logs failures", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    syncG2bNoticesMock.mockRejectedValueOnce(new Error("나라장터 동기화 실패"));

    const response = await GET(
      createRequest({
        headers: {
          authorization: "Bearer test-cron-secret"
        }
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "나라장터 동기화 실패" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[api/sync] Sync failed", expect.any(Error));
  });
});

function createRequest(init: ConstructorParameters<typeof NextRequest>[1] = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/sync", init);
}

function createSummary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    fetched: 0,
    stored: 0,
    candidates: 0,
    notified: 0,
    skippedNotifications: 0,
    ...overrides
  };
}
