import type { NoticeMetadata } from "@/lib/types";

export interface NoticeAttachmentDownload {
  sequence: number;
  name: string;
  url: string;
}

export function findNoticeAttachment(metadata: NoticeMetadata, sequence: number): NoticeAttachmentDownload | null {
  const attachments = getDetailAttachments(metadata);

  return attachments.find((attachment) => attachment.sequence === sequence) ?? null;
}

export function validateG2bDownloadUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("첨부파일 URL 형식이 올바르지 않습니다.");
  }

  if (url.protocol !== "https:") {
    throw new Error("나라장터 HTTPS 첨부파일만 다운로드할 수 있습니다.");
  }

  if (url.hostname !== "www.g2b.go.kr") {
    throw new Error("나라장터 첨부파일만 다운로드할 수 있습니다.");
  }

  if (!url.pathname.includes("/UntyAtchFile/downloadFile.do")) {
    throw new Error("허용된 나라장터 첨부파일 다운로드 경로가 아닙니다.");
  }

  return url;
}

export function buildDownloadHeaders(upstreamHeaders: Headers, fileName: string): Headers {
  const headers = new Headers();
  const contentType = upstreamHeaders.get("content-type") || "application/octet-stream";
  const contentLength = upstreamHeaders.get("content-length");

  headers.set("content-type", contentType);
  headers.set("content-disposition", buildContentDisposition(fileName));
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");

  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return headers;
}

function getDetailAttachments(metadata: NoticeMetadata): NoticeAttachmentDownload[] {
  const detail = metadata.detail;

  if (!detail || typeof detail !== "object") {
    return [];
  }

  const attachments = (detail as Record<string, unknown>).attachments;

  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map(toNoticeAttachmentDownload)
    .filter((attachment): attachment is NoticeAttachmentDownload => attachment !== null);
}

function toNoticeAttachmentDownload(value: unknown): NoticeAttachmentDownload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sequence = record.sequence;
  const name = record.name;
  const url = record.url;

  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
    return null;
  }

  if (typeof name !== "string" || !name.trim()) {
    return null;
  }

  if (typeof url !== "string" || !url.trim()) {
    return null;
  }

  return {
    sequence,
    name: name.trim(),
    url: url.trim()
  };
}

function buildContentDisposition(fileName: string): string {
  const safeName = sanitizeFileName(fileName) || "attachment";
  const fallbackName = safeName.replace(/[^\x20-\x7E]/g, "_").replace(/[";]/g, "_");
  const encodedName = encodeRFC5987ValueChars(safeName);

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\r\n\\/]/g, "_").trim().slice(0, 180);
}

function encodeRFC5987ValueChars(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}
