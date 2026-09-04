export const DEFAULT_TIMEZONE = "Asia/Yangon";

export type TimezoneGroup = { region: string; zones: string[] };

function safeDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value: string | Date | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

export function formatTime(value: string | Date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const d = safeDate(value) ?? new Date();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d);
}

/** Calendar dates (YYYY-MM-DD) are displayed as-is, without shifting by timezone. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value || value === "-") return value || "";
  const ymd = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return value;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function calendarDate(timeZone = DEFAULT_TIMEZONE, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatClockLabel(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const time = formatTime(date, timeZone);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(date);
  return `${day} · ${time}`;
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let n = size / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}
