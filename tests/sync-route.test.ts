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

  it("defaults to manual mode (no Slack) when called without ?source=cron", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const summary = createSummary();
    syncG2bNoticesMock.mockResolvedValueOnce(summary);

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(syncG2bNoticesMock).toHaveBeenCalledWith(
      expect.objectContaining({ notifySlack: false })
    );
  });

  it("runs manual mode without requiring authorization even when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const summary = createSummary();
    syncG2bNoticesMock.mockResolvedValueOnce(summary);

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    expect(syncG2bNoticesMock).toHaveBeenCalledWith(
      expect.objectContaining({ notifySlack: false })
    );
  });

  it("blocks ?source=cron requests without a matching bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(createRequest({ url: "http://localhost:3000/api/sync?source=cron" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(syncG2bNoticesMock).not.toHaveBeenCalled();
  });

  it("blocks ?source=cron requests when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(
      createRequest({
        url: "http://localhost:3000/api/sync?source=cron",
        headers: { authorization: "Bearer anything" }
      })
    );

    expect(response.status).toBe(401);
    expect(syncG2bNoticesMock).not.toHaveBeenCalled();
  });

  it("enables Slack notifications for ?source=cron with a matching bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const summary = createSummary({ fetched: 12, candidates: 3, stored: 3, notified: 3 });
    syncG2bNoticesMock.mockResolvedValueOnce(summary);

    const response = await POST(
      createRequest({
        url: "http://localhost:3000/api/sync?source=cron",
        method: "POST",
        headers: {
          authorization: "Bearer test-cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(syncG2bNoticesMock).toHaveBeenCalledWith(
      expect.objectContaining({ notifySlack: true })
    );
  });

  it("returns a readable error and logs failures", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    syncG2bNoticesMock.mockRejectedValueOnce(new Error("나라장터 동기화 실패"));

    const response = await GET(
      createRequest({
        url: "http://localhost:3000/api/sync?source=cron",
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

function createRequest(
  init: { url?: string } & ConstructorParameters<typeof NextRequest>[1] = {}
): NextRequest {
  const { url, ...rest } = init;
  return new NextRequest(url ?? "http://localhost:3000/api/sync", rest);
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
