export function formatG2bDateTime(date: Date, endOfDay = false): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const time = endOfDay ? "2359" : "0000";

  return `${year}${month}${day}${time}`;
}

export function parseKoreanDateTime(date?: string, time?: string): string | undefined {
  if (!date) {
    return undefined;
  }

  const normalizedTime = time?.trim() || "00:00";
  const iso = `${date.trim()}T${normalizedTime}:00+09:00`;
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function isFutureOrToday(value?: string): boolean {
  if (!value) {
    return true;
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return true;
  }

  return target.getTime() >= Date.now();
}

export function formatDateLabel(value?: string): string {
  if (!value) {
    return "일정 미확인";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
