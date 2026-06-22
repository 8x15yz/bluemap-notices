const tableRowPattern = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
const tableCellBoundaryPattern = /<\/(?:td|th)>\s*<(?:td|th)\b[^>]*>/gi;
const htmlTagPattern = /<[^>]+>/g;

const namedEntities: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
  apos: "'"
};

export function normalizeExtractedTableFragments(text: string): string {
  return text.replace(tableRowPattern, (fragment) => htmlTableRowToText(fragment));
}

export function normalizeExtractedTextLine(text: string): string {
  return decodeHtmlEntities(normalizeExtractedTableFragments(text))
    .replace(tableCellBoundaryPattern, " / ")
    .replace(htmlTagPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeMarkdownTableCell(text: string): string {
  return normalizeExtractedTextLine(text).replace(/\|/g, "\\|") || "문서에서 확인 필요";
}

function htmlTableRowToText(fragment: string): string {
  return decodeHtmlEntities(fragment)
    .replace(tableCellBoundaryPattern, " / ")
    .replace(htmlTagPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => namedEntities[name.toLowerCase()] ?? match);
}
