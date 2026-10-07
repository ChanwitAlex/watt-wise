import { ANALOG_RADIUS_DAYS, ANALOG_YEARS, ARCHIVE_LAG_DAYS, CLIMATOLOGY_LEVELS } from "@/lib/config/weather";
import { RISK_THRESHOLDS, RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import type { ModelParams } from "@/types/model-params";
import type { ForecastHour } from "@/types/weather";
import { addDays, diffDays } from "./dates";
import { isOffDay } from "./forecast";
import { predictRisk, predictUsageKwh, severityOf } from "./inference";
import type { RiskLevel } from "./risk";

export interface AnalogWindow {
  year: number;
  start: string;
  end: string;
}

/** เลือกปีย้อนหลัง (ใหม่สุดก่อน) ที่ช่วง ±N วันรอบวันเดียวกันของปีนั้นจบก่อนข้อมูล archive จะพร้อม */
export function analogWindows(target: string, today: string, years = ANALOG_YEARS, radius = ANALOG_RADIUS_DAYS): AnalogWindow[] {
  const [, month, day] = target.split("-").map(Number);
  const readyBefore = addDays(today, -ARCHIVE_LAG_DAYS);
  const windows: AnalogWindow[] = [];
  for (let year = Number(target.slice(0, 4)) - 1; windows.length < years && year > 1940; year--) {
    const center = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10); // 29 ก.พ. ในปีไม่อธิกสุรทินเลื่อนเป็น 1 มี.ค.
    const end = addDays(center, radius);
    if (end >= readyBefore) continue;
    windows.push({ year, start: addDays(center, -radius), end });
  }
  return windows;
}

export interface AnalogDay {
  date: string;
  year: number;
  maxSeverity: number;
  maxRisk: number;
  alertHours: number;
  rainMm: number;
  tempMeanC: number;
  kwh: number;
}

/** รันกฎ/โมเดลกับอากาศรายชั่วโมงของ "วันเทียบเคียง" โดยใช้ประเภทวัน (วันหยุด/วันทำงาน) ของวันที่เป้าหมาย */
export function analyzeAnalogDays(hours: ForecastHour[], params: ModelParams, targetDate: string): AnalogDay[] {
  const off = isOffDay(targetDate);
  const byDate = new Map<string, ForecastHour[]>();
  for (const h of hours) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h]);
  const days: AnalogDay[] = [];
  for (const [date, hs] of byDate) {
    if (hs.length < 20) continue; // วันที่ข้อมูลขาดมากไม่นำมาใช้
    let maxSeverity = 0;
    let maxRisk = 0;
    let alertHours = 0;
    let kwh = 0;
    for (const h of hs) {
      const severity = severityOf(params, h.windKmh, h.rainMm);
      const risk = predictRisk(params, {
        hour: h.hour, is_weekend: off ? 1 : 0, is_holiday: 0,
        wind_speed_kmh: h.windKmh, wind_gust_kmh: h.gustKmh, rainfall_mm: h.rainMm,
      });
      maxSeverity = Math.max(maxSeverity, severity);
      maxRisk = Math.max(maxRisk, risk);
      if (severity >= RULE_SEVERITY_THRESHOLD) alertHours++;
      kwh += predictUsageKwh(params, { isOffDay: off, hour: h.hour, tempC: h.tempC });
    }
    days.push({
      date, year: Number(date.slice(0, 4)), maxSeverity, maxRisk, alertHours, kwh,
      rainMm: hs.reduce((s, h) => s + h.rainMm, 0),
      tempMeanC: hs.reduce((s, h) => s + h.tempC, 0) / hs.length,
    });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface ClimatologySummary {
  n: number;
  years: number;
  shareAlert: number; // สัดส่วนวันเทียบเคียงที่มีอย่างน้อย 1 ชั่วโมงติดเตือน (ตามกฎ)
  shareSevere: number; // สัดส่วนวันที่ดัชนีสูงสุด ≥ เกณฑ์เสี่ยงสูง
  shareModel: number; // สัดส่วนวันที่ Decision Tree ให้ความเสี่ยงสูงสุด ≥ เกณฑ์เฝ้าระวัง
  meanMaxSeverity: number;
  p90MaxSeverity: number;
  meanKwh: number;
  kwhP10: number;
  kwhP90: number;
  meanRainMm: number;
  meanTempC: number;
}

export function summarizeAnalogs(days: AnalogDay[]): ClimatologySummary | null {
  if (days.length === 0) return null;
  const n = days.length;
  const share = (pred: (d: AnalogDay) => boolean) => days.filter(pred).length / n;
  const mean = (pick: (d: AnalogDay) => number) => days.reduce((s, d) => s + pick(d), 0) / n;
  const sev = days.map((d) => d.maxSeverity).sort((a, b) => a - b);
  const kwh = days.map((d) => d.kwh).sort((a, b) => a - b);
  return {
    n,
    years: new Set(days.map((d) => d.year)).size,
    shareAlert: share((d) => d.alertHours > 0),
    shareSevere: share((d) => d.maxSeverity >= RISK_THRESHOLDS.high),
    shareModel: share((d) => d.maxRisk >= RISK_THRESHOLDS.warning),
    meanMaxSeverity: mean((d) => d.maxSeverity),
    p90MaxSeverity: percentile(sev, 0.9),
    meanKwh: mean((d) => d.kwh),
    kwhP10: percentile(kwh, 0.1),
    kwhP90: percentile(kwh, 0.9),
    meanRainMm: mean((d) => d.rainMm),
    meanTempC: mean((d) => d.tempMeanC),
  };
}

export function climatologyLevel(shareAlert: number): RiskLevel {
  if (shareAlert >= CLIMATOLOGY_LEVELS.high) return "high";
  if (shareAlert >= CLIMATOLOGY_LEVELS.moderate) return "warning";
  return "normal";
}

export interface YearBreakdown {
  year: number;
  days: number;
  alertDays: number;
  worstDate: string;
  worstSeverity: number;
}

export function breakdownByYear(days: AnalogDay[]): YearBreakdown[] {
  const byYear = new Map<number, AnalogDay[]>();
  for (const d of days) byYear.set(d.year, [...(byYear.get(d.year) ?? []), d]);
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, ds]) => {
      const worst = ds.reduce((a, b) => (b.maxSeverity > a.maxSeverity ? b : a));
      return { year, days: ds.length, alertDays: ds.filter((d) => d.alertHours > 0).length, worstDate: worst.date, worstSeverity: worst.maxSeverity };
    });
}

export function daysAheadLabel(target: string, today: string): string {
  const n = diffDays(today, target);
  if (n === 0) return "วันนี้";
  if (n === 1) return "พรุ่งนี้";
  if (n < 30) return `อีก ${n} วัน`;
  if (n < 365) return `อีกประมาณ ${Math.round(n / 30)} เดือน`;
  return `อีกประมาณ ${(n / 365).toFixed(1)} ปี`;
}
