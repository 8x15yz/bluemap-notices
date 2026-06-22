import { NextRequest, NextResponse } from "next/server";
import { syncG2bNotices } from "@/lib/services/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await syncG2bNotices();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[api/sync] Sync failed", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "동기화에 실패했습니다."
      },
      { status: 500 }
    );
  }
}
