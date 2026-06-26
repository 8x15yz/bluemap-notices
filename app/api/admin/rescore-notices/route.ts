import { NextRequest, NextResponse } from "next/server";
import { rescoreAllNotices } from "@/lib/repositories/rescore";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const authorizedSecrets = [process.env.ADMIN_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret)
  );
  const authorization = request.headers.get("authorization");

  if (authorizedSecrets.length === 0 || !authorizedSecrets.some((secret) => authorization === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  try {
    const summary = await rescoreAllNotices({ dryRun });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[api/admin/rescore-notices] Rescore failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "재채점에 실패했습니다." },
      { status: 500 }
    );
  }
}
