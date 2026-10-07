import { RiskGauge } from "@/components/dashboard/RiskGauge";
import { RiskCard } from "@/components/dashboard/RiskCard";
import { LevelBadge } from "@/components/ui/Badge";
import type { ForecastDaySummary } from "@/lib/analytics/forecast";
import { RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import { formatHour, formatPercent } from "@/lib/format";

export function ForecastSummary({ day }: { day: ForecastDaySummary }) {
  return (
    <div className="cards">
      <RiskCard
        wide
        title="ดัชนีสภาพอากาศสูงสุดของวัน (ตามกฎ)"
        value={day.maxSeverity.toFixed(2)}
        badge={<LevelBadge level={day.ruleLevel} />}
        hint={`ลมสูงสุด ${day.maxWindKmh.toFixed(0)} กม./ชม. (กระโชก ${day.maxGustKmh.toFixed(0)}) · ฝนรวม ${day.totalRainMm.toFixed(1)} มม. · ติดเตือน ${day.alertHours} ชั่วโมง (เกณฑ์ ≥ ${RULE_SEVERITY_THRESHOLD})`}
      >
        <RiskGauge value={day.maxSeverity} />
      </RiskCard>
      <RiskCard
        title="ความเสี่ยงไฟดับจากโมเดล"
        value={formatPercent(day.maxRisk)}
        hint={`Decision Tree · สูงสุดช่วง ${formatHour(day.maxRiskHour)}`}
      />
      <RiskCard
        title="ระยะเวลาไฟดับที่คาดไว้"
        value={`~${Math.round(day.maxRiskDurationMin)} นาที`}
        hint={`ถ้าเกิดไฟดับช่วง ${formatHour(day.maxRiskHour)} (ชั่วโมงเสี่ยงสุด) ไม่ได้แปลว่าไฟจะดับ`}
      />
      <RiskCard
        title="คาดการณ์การใช้ไฟทั้งวัน"
        value={`${day.totalKwh.toFixed(1)} kWh`}
        hint={`สูงสุดช่วง ${formatHour(day.peakUsageHour)} (${day.peakUsageKwh.toFixed(2)} kWh)`}
      />
      <RiskCard title="อุณหภูมิสูงสุด" value={`${day.maxTempC.toFixed(0)}°C`} hint="ที่จุดของคุณ" />
    </div>
  );
}
