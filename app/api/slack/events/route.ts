import { after, NextRequest, NextResponse } from "next/server";
import { recordSlackEventReceipt } from "@/lib/repositories/slack-digests";
import { handleSlackThreadEvent, type SlackMessageEvent, verifySlackSignature } from "@/lib/services/slack-events";

export const runtime = "nodejs";

type SlackEventRequestBody = {
  type?: string;
  challenge?: string;
  event_id?: string;
  event?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const verified = verifySlackSignature({
    body,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    signingSecret: process.env.SLACK_SIGNING_SECRET
  });

  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SlackEventRequestBody;

  try {
    payload = JSON.parse(body) as SlackEventRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event && typeof payload.event === "object") {
    if (payload.event_id) {
      const isFirstReceipt = await recordSlackEventReceipt(payload.event_id);

      if (!isFirstReceipt) {
        return NextResponse.json({ ok: true, result: { status: "ignored", reason: "duplicate_event" } });
      }
    }

    const event = payload.event as SlackMessageEvent;

    after(async () => {
      await handleSlackThreadEvent(event);
    });

    return NextResponse.json({ ok: true, result: { status: "queued" } });
  }

  return NextResponse.json({ ok: true, result: { status: "ignored", reason: "unsupported_payload" } });
}
