export function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function formatThaiDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined ? "-" : n.toFixed(digits);
}
