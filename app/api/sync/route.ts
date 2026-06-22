import { NextRequest, NextResponse } from "next/server";
import { syncG2bNotices, type SyncProgressEvent } from "@/lib/services/sync";
import type { SyncSummary } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

type SyncRouteEvent =
  | SyncProgressEvent
  | ({ phase: "done" } & SyncSummary)
  | { phase: "error"; message: string };

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function handleSync(request: NextRequest): Promise<Response> {
  const isStreaming = request.headers.get("accept")?.includes("text/event-stream");
  const secret = process.env.CRON_SECRET;

  if (secret && !isStreaming) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const lookbackDays = parsePositiveInt(url.searchParams.get("lookbackDays"));
  const maxPages = parsePositiveInt(url.searchParams.get("maxPages"));

  if (!isStreaming) {
    try {
      const summary = await syncG2bNotices({ lookbackDays, maxPages });
      return NextResponse.json(summary);
    } catch (error) {
      console.error("[api/sync] Sync failed", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "동기화에 실패했습니다." },
        { status: 500 }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SyncRouteEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const summary = await syncG2bNotices({
          lookbackDays,
          maxPages,
          onProgress: send,
        });
        send({ phase: "done", ...summary });
      } catch (error) {
        console.error("[api/sync] Sync failed", error);
        send({ phase: "error", message: error instanceof Error ? error.message : "동기화에 실패했습니다." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
