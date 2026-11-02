export function hkToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hkMonthKey(now = new Date()): string {
  return hkToday(now).slice(0, 7);
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= 2000 &&
    year <= 2100
  );
}

export function shiftDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function monthBounds(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(last).padStart(2, "0")}`,
  };
}

export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) - 1;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAYS[date.getUTCDay()] ?? "";
}

export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatHkd(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const fraction = abs % 100;
  const body = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const suffix = fraction === 0 ? "" : `.${String(fraction).padStart(2, "0")}`;
  return `${negative ? "-" : ""}HK$${body}${suffix}`;
}

export function formatHkdNumber(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  return `${negative ? "-" : ""}${(abs / 100).toFixed(2)}`;
}

export function parseHkdToCents(
  raw: string,
  options?: { allowZero?: boolean; maxDollars?: number },
): { ok: true; cents: number } | { ok: false; error: string } {
  const allowZero = options?.allowZero ?? false;
  const maxDollars = options?.maxDollars ?? 1_000_000;
  const cleaned = raw
    .trim()
    .replace(/,/g, "")
    .replace(/^HK\$?/i, "")
    .replace(/^\$/, "")
    .trim();
  if (!cleaned) return { ok: false, error: "請輸入金額" };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: "請輸入有效金額" };
  const [dollars, fraction = ""] = cleaned.split(".");
  if (fraction.length > 2) return { ok: false, error: "金額最多兩位小數" };
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "金額太大" };
  if (cents === 0 && !allowZero) return { ok: false, error: "金額須大於 0" };
  if (cents < 0) return { ok: false, error: "金額須大於 0" };
  if (cents > maxDollars * 100) {
    return { ok: false, error: `金額不能超過 HK$${maxDollars.toLocaleString("en-HK")}` };
  }
  return { ok: true, cents };
}

export function payerName(
  payer: "boyfriend" | "girlfriend",
  names?: { boyfriendName?: string; girlfriendName?: string },
): string {
  if (payer === "boyfriend") return names?.boyfriendName || "男朋友";
  return names?.girlfriendName || "女朋友";
}
