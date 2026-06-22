import { describe, expect, it } from "vitest";
import {
  groupFilterRules,
  isFilterRuleType,
  normalizeFilterKeyword,
  type FilterRule
} from "@/lib/repositories/filter-rules";

describe("filter rule helpers", () => {
  it("normalizes user-entered keywords", () => {
    expect(normalizeFilterKeyword("  해양   디지털트윈  ")).toBe("해양 디지털트윈");
  });

  it("guards filter rule types", () => {
    expect(isFilterRuleType("include_keyword")).toBe(true);
    expect(isFilterRuleType("it_signal")).toBe(true);
    expect(isFilterRuleType("non_it_exclude")).toBe(true);
    expect(isFilterRuleType("unknown")).toBe(false);
  });

  it("groups rules by type", () => {
    const groups = groupFilterRules([
      createRule({ id: 1, ruleType: "include_keyword", keyword: "해양" }),
      createRule({ id: 2, ruleType: "it_signal", keyword: "GIS" }),
      createRule({ id: 3, ruleType: "non_it_exclude", keyword: "토목공사" })
    ]);

    expect(groups.include_keyword.map((rule) => rule.keyword)).toEqual(["해양"]);
    expect(groups.it_signal.map((rule) => rule.keyword)).toEqual(["GIS"]);
    expect(groups.non_it_exclude.map((rule) => rule.keyword)).toEqual(["토목공사"]);
  });
});

function createRule(overrides: Partial<FilterRule>): FilterRule {
  return {
    id: overrides.id ?? 1,
    ruleType: overrides.ruleType ?? "include_keyword",
    keyword: overrides.keyword ?? "해양",
    enabled: overrides.enabled ?? true,
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z"
  };
}
