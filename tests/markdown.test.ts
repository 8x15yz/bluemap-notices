import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("markdown rendering", () => {
  it("renders strategy memo markdown as document HTML", () => {
    const html = renderMarkdown("## 추천 이유\n- 해양 GIS 역량과 맞습니다.");

    expect(html).toContain("<h2>추천 이유</h2>");
    expect(html).toContain("<li>해양 GIS 역량과 맞습니다.</li>");
  });

  it("escapes raw HTML from generated markdown", () => {
    const html = renderMarkdown("<script>alert('x')</script>");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("cleans extracted table row fragments inside markdown tables", () => {
    const html = renderMarkdown(
      [
        "| 항목 | 내용 |",
        "|---|---|",
        "| 과업 범위 | <tr><th>공고명</th><th colspan=\"2\">재난정보시스템 서버 가상화 구축 (SW 도입)</th></tr> |",
        "| 제출물/산출물 | <tr><td>납품장소</td><td>수요기관 지정장소</td><td>인도조건</td></tr> |"
      ].join("\n")
    );

    expect(html).not.toContain("&lt;tr");
    expect(html).not.toContain("&lt;th");
    expect(html).not.toContain("colspan");
    expect(html).toContain("공고명 / 재난정보시스템 서버 가상화 구축 (SW 도입)");
    expect(html).toContain("납품장소 / 수요기관 지정장소 / 인도조건");
  });

  it("opens external links in a new tab", () => {
    const html = renderMarkdown("[나라장터](https://www.g2b.go.kr)");

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});
