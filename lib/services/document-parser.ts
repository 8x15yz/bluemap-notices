export interface ParsedDocument {
  markdown: string;
  metadata: Record<string, unknown>;
}

export const SUPPORTED_DOCUMENT_EXTENSIONS = [".pdf", ".hwpx", ".hwp"] as const;

export async function parseUploadedDocument(file: File): Promise<ParsedDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return parseDocumentBuffer(file.name, buffer);
}

export async function parseDocumentBuffer(fileName: string, buffer: Buffer): Promise<ParsedDocument> {
  if (!isSupportedDocumentFileName(fileName)) {
    throw new Error("PDF, HWPX 또는 HWP 파일만 업로드할 수 있습니다.");
  }

  const { parse } = await import("kordoc");
  const result = await parse(toArrayBuffer(buffer));

  if (!result.success) {
    const errorMessage = result.error || "첨부파일을 Markdown으로 변환하지 못했습니다.";
    throw new Error(errorMessage);
  }

  return {
    markdown: result.markdown || "",
    metadata: (result.metadata ?? {}) as Record<string, unknown>
  };
}

export function isSupportedDocumentFileName(fileName: string): boolean {
  const extension = getExtension(fileName);

  return SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension as (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number]);
}

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLocaleLowerCase("ko-KR") : "";
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}
