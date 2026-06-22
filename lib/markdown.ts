import MarkdownIt from "markdown-it";
import { normalizeExtractedTableFragments } from "@/lib/utils/text-cleanup";

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: true
});

const defaultLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = token.attrGet("href") ?? "";

  if (href.startsWith("http://") || href.startsWith("https://")) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noreferrer");
  }

  return defaultLinkOpen(tokens, index, options, env, self);
};

export function renderMarkdown(markdownText: string): string {
  return markdown.render(normalizeExtractedTableFragments(markdownText));
}
