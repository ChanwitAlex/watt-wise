import { RISK_LEVEL_LABEL, type RiskLevel } from "@/lib/analytics/risk";

export function LevelBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge badge--${level}`}>{RISK_LEVEL_LABEL[level]}</span>;
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "alert" | "info" }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}
