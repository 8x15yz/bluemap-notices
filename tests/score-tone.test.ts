import { describe, expect, it } from "vitest";
import { getScoreTone, getScoreToneClass } from "@/lib/score-tone";

describe("score tone", () => {
  it("maps score ranges to visual tone buckets", () => {
    expect(getScoreTone(0)).toBe("low");
    expect(getScoreTone(25)).toBe("low");
    expect(getScoreTone(26)).toBe("mediumLow");
    expect(getScoreTone(50)).toBe("mediumLow");
    expect(getScoreTone(51)).toBe("mediumHigh");
    expect(getScoreTone(75)).toBe("mediumHigh");
    expect(getScoreTone(76)).toBe("high");
    expect(getScoreTone(100)).toBe("high");
  });

  it("builds the score tone CSS class", () => {
    expect(getScoreToneClass(80)).toBe("score-tone-high");
  });
});
