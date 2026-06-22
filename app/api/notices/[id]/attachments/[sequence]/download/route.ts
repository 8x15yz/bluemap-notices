import { NextRequest, NextResponse } from "next/server";
import { getNotice } from "@/lib/repositories/notices";
import { buildDownloadHeaders, findNoticeAttachment, validateG2bDownloadUrl } from "@/lib/services/attachment-download";

export const runtime = "nodejs";
export const maxDuration = 60;

type AttachmentDownloadRouteContext = {
  params: Promise<{
    id: string;
    sequence: string;
  }>;
};

export async function GET(request: NextRequest, context: AttachmentDownloadRouteContext): Promise<NextResponse> {
  const { id, sequence } = await context.params;
  const noticeId = decodeURIComponent(id);
  const attachmentSequence = Number(sequence);

  if (!Number.isInteger(attachmentSequence) || attachmentSequence < 0) {
    return NextResponse.json({ error: "첨부파일 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const notice = await getNotice(noticeId);

  if (!notice) {
    return NextResponse.json({ error: "공고를 찾지 못했습니다." }, { status: 404 });
  }

  const attachment = findNoticeAttachment(notice.metadata, attachmentSequence);

  if (!attachment) {
    return NextResponse.json({ error: "첨부파일을 찾지 못했습니다." }, { status: 404 });
  }

  let downloadUrl: URL;

  try {
    downloadUrl = validateG2bDownloadUrl(attachment.url);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "첨부파일 URL을 사용할 수 없습니다." }, { status: 400 });
  }

  const upstreamResponse = await fetch(downloadUrl, {
    headers: {
      accept: "*/*",
      referer: notice.url,
      "user-agent": request.headers.get("user-agent") || "Mozilla/5.0"
    },
    cache: "no-store",
    redirect: "follow"
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return NextResponse.json(
      {
        error: `나라장터 첨부파일 다운로드에 실패했습니다. (HTTP ${upstreamResponse.status})`
      },
      { status: 502 }
    );
  }

  return new NextResponse(upstreamResponse.body, {
    status: 200,
    headers: buildDownloadHeaders(upstreamResponse.headers, attachment.name)
  });
}
