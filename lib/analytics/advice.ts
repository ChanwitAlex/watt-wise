import type { ForecastPoint } from "./forecast";
import { RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";

export interface RuleAlert {
  timestamp: string;
  date: string;
  hour: number;
  severity: number;
  windKmh: number;
  rainfallMm: number;
  advice: string;
}

/** ข้อความแนะนำตามกฎ (rule-based) ไม่ได้มาจากโมเดล */
export function adviceForSeverity(severity: number): string {
  if (severity >= 0.6) return "สภาพอากาศรุนแรง ชาร์จอุปกรณ์ให้เต็ม เตรียมไฟฉาย และงดใช้เครื่องใช้ไฟฟ้ากำลังสูงชั่วคราว";
  return "สภาพอากาศเริ่มเสี่ยง ชาร์จอุปกรณ์สำคัญ และเตรียมไฟฉายไว้ใกล้มือ";
}

/** ชั่วโมงในพยากรณ์ที่ดัชนีสภาพอากาศถึงเกณฑ์เตือน เรียงตามเวลา (ใกล้สุดก่อน) */
export function toRuleAlerts(points: ForecastPoint[]): RuleAlert[] {
  return points
    .filter((p) => p.severity >= RULE_SEVERITY_THRESHOLD)
    .map((p) => ({
      timestamp: p.timestamp,
      date: p.date,
      hour: p.hour,
      severity: p.severity,
      windKmh: p.windKmh,
      rainfallMm: p.rainMm,
      advice: adviceForSeverity(p.severity),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
