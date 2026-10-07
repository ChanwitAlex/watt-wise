import { HOLIDAYS } from "@/lib/config/holidays";
import { RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import type { ModelParams } from "@/types/model-params";
import type { ForecastHour } from "@/types/weather";
import type { ZoneSeries } from "./zones";
import { predictDurationMin, predictRisk, predictUsageKwh, severityOf } from "./inference";
import { toRiskLevel, type RiskLevel } from "./risk";

export interface ForecastPoint extends ForecastHour {
  isOffDay: boolean;
  severity: number; // ดัชนีสภาพอากาศ (กฎ)
  riskProb: number; // ความน่าจะเป็นไฟดับจาก Decision Tree
  expectedDurationMin: number;
  usageKwh: number;
}

/** เสาร์-อาทิตย์ หรือวันที่อยู่ในรายการวันหยุดที่ตั้งไว้ */
export function isOffDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || HOLIDAYS.includes(date);
}

export function buildForecastPoints(hours: ForecastHour[], params: ModelParams): ForecastPoint[] {
  return hours.map((h) => {
    const off = isOffDay(h.date);
    const features = {
      hour: h.hour,
      is_weekend: off ? 1 : 0,
      is_holiday: HOLIDAYS.includes(h.date) ? 1 : 0,
      wind_speed_kmh: h.windKmh,
      wind_gust_kmh: h.gustKmh,
      rainfall_mm: h.rainMm,
    };
    return {
      ...h,
      isOffDay: off,
      severity: severityOf(params, h.windKmh, h.rainMm),
      riskProb: predictRisk(params, features),
      expectedDurationMin: predictDurationMin(params, features),
      usageKwh: predictUsageKwh(params, { isOffDay: off, hour: h.hour, tempC: h.tempC }),
    };
  });
}

export interface ForecastDaySummary {
  date: string;
  maxSeverity: number;
  ruleLevel: RiskLevel;
  alertHours: number;
  maxRisk: number;
  maxRiskHour: number;
  /** ระยะเวลาไฟดับที่คาด (นาที) ถ้าเกิดไฟดับในชั่วโมงที่เสี่ยงสุด */
  maxRiskDurationMin: number;
  totalKwh: number;
  peakUsageHour: number;
  peakUsageKwh: number;
  totalRainMm: number;
  maxWindKmh: number;
  maxGustKmh: number;
  maxTempC: number;
}

export function forecastDates(points: ForecastPoint[]): string[] {
  return [...new Set(points.map((p) => p.date))].sort();
}

export function summarizeForecastDay(points: ForecastPoint[], date: string): ForecastDaySummary | null {
  const day = points.filter((p) => p.date === date);
  if (day.length === 0) return null;
  const maxBy = (pick: (p: ForecastPoint) => number) => day.reduce((a, b) => (pick(b) > pick(a) ? b : a));
  const sev = maxBy((p) => p.severity);
  const risk = maxBy((p) => p.riskProb);
  const peak = maxBy((p) => p.usageKwh);
  return {
    date,
    maxSeverity: sev.severity,
    ruleLevel: toRiskLevel(sev.severity),
    alertHours: day.filter((p) => p.severity >= RULE_SEVERITY_THRESHOLD).length,
    maxRisk: risk.riskProb,
    maxRiskHour: risk.hour,
    maxRiskDurationMin: risk.expectedDurationMin,
    totalKwh: day.reduce((s, p) => s + p.usageKwh, 0),
    peakUsageHour: peak.hour,
    peakUsageKwh: peak.usageKwh,
    totalRainMm: day.reduce((s, p) => s + p.rainMm, 0),
    maxWindKmh: Math.max(...day.map((p) => p.windKmh)),
    maxGustKmh: Math.max(...day.map((p) => p.gustKmh)),
    maxTempC: Math.max(...day.map((p) => p.tempC)),
  };
}

export function resolveForecastDate(points: ForecastPoint[], requested?: string): string | null {
  const dates = forecastDates(points);
  if (requested && dates.includes(requested)) return requested;
  return dates[0] ?? null;
}

/** ดัชนีสภาพอากาศจริง (จากพยากรณ์) รายอำเภอ สำหรับแผนที่ความร้อน */
export function zoneSeriesFromForecast(
  perZone: { locationId: string; name: string; hours: ForecastHour[] }[],
  date: string,
  params: ModelParams,
): ZoneSeries[] {
  return perZone.map((zone) => {
    const byHour = new Map(zone.hours.filter((h) => h.date === date).map((h) => [h.hour, severityOf(params, h.windKmh, h.rainMm)]));
    return { id: zone.locationId, name: zone.name, values: Array.from({ length: 24 }, (_, h) => byHour.get(h) ?? null) };
  });
}
