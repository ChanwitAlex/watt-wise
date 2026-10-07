/** ฟังก์ชันวันที่ (pure) ใช้เวลาประเทศไทยเป็นหลัก รูปแบบ YYYY-MM-DD */
const MS_PER_DAY = 86_400_000;

export function todayBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function isValidDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value)) && new Date(toUtc(value)).toISOString().slice(0, 10) === value;
}

export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addYears(date: string, n: number): string {
  const d = new Date(toUtc(date));
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/** จำนวนวันจาก a ถึง b (b หลัง a = ค่าบวก) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY);
}

export type PredictionMode = "forecast" | "climatology";

/** ภายใน `forecastDays` วันนับจากวันนี้ใช้พยากรณ์อากาศจริง นอกนั้นใช้สถิติ */
export function predictionMode(target: string, today: string, forecastDays: number): PredictionMode {
  return diffDays(today, target) < forecastDays ? "forecast" : "climatology";
}

/** บังคับวันที่ให้อยู่ในช่วง [today, today + maxYears ปี] ถ้าไม่ถูกต้องใช้วันนี้ */
export function clampTarget(requested: string | undefined, today: string, maxYears: number): { date: string; adjusted: boolean } {
  if (!isValidDate(requested)) return { date: today, adjusted: requested !== undefined && requested !== "" };
  const max = addYears(today, maxYears);
  if (requested < today) return { date: today, adjusted: true };
  if (requested > max) return { date: max, adjusted: true };
  return { date: requested, adjusted: false };
}
