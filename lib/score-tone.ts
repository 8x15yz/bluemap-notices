export type ScoreTone = "low" | "mediumLow" | "mediumHigh" | "high";

export function getScoreTone(score: number): ScoreTone {
  if (score <= 25) {
    return "low";
  }

  if (score <= 50) {
    return "mediumLow";
  }

  if (score <= 75) {
    return "mediumHigh";
  }

  return "high";
}

export function getScoreToneClass(score: number): string {
  return `score-tone-${getScoreTone(score)}`;
}
