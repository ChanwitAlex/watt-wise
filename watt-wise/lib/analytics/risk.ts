import { RISK_THRESHOLDS } from "@/lib/config/risk";

export type RiskLevel = "normal" | "warning" | "high";

export function toRiskLevel(p: number): RiskLevel {
  if (p >= RISK_THRESHOLDS.high) return "high";
  if (p >= RISK_THRESHOLDS.warning) return "warning";
  return "normal";
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  normal: "ปกติ",
  warning: "เฝ้าระวัง",
  high: "เสี่ยงสูง",
};
