import Link from "next/link";
import { AlertList } from "@/components/dashboard/AlertList";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { WeatherChart } from "@/components/dashboard/WeatherChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsageForecastChart } from "./UsageForecastChart";
import { toRuleAlerts } from "@/lib/analytics/advice";
import {
  forecastDates,
  resolveForecastDate,
  summarizeForecastDay,
  zoneSeriesFromForecast,
  type ForecastDaySummary,
} from "@/lib/analytics/forecast";
import { Verdict } from "@/components/predict/Verdict";
import { daysAheadLabel } from "@/lib/analytics/climatology";
import { todayBangkok } from "@/lib/analytics/dates";
import { toRiskLevel, type RiskLevel } from "@/lib/analytics/risk";
import { formatThaiDate } from "@/lib/format";
import { loadForecastView } from "@/lib/data/forecast-view";
import { FORECAST_DAYS, WEATHER_ATTRIBUTION } from "@/lib/config/weather";
import type { ViewMode } from "@/lib/config/site";
import { ForecastUnavailableError } from "@/lib/weather/open-meteo";
import { DayTabs } from "./DayTabs";
import { ForecastSummary } from "./ForecastSummary";

export async function ForecastContent({
  date,
  latitude,
  longitude,
  viewMode,
}: {
  date?: string;
  latitude: number;
  longitude: number;
  viewMode: ViewMode;
}) {
  let view;
  try {
    view = await loadForecastView(latitude, longitude);
  } catch (error) {
    if (!(error instanceof ForecastUnavailableError)) throw error;
    return (
      <EmptyState
        title="ดึงพยากรณ์อากาศไม่สำเร็จ"
        hint={`${error.message} ลองโหลดหน้านี้ใหม่อีกครั้งในอีกสักครู่`}
        action={
          <Link className="btn btn--primary" href={`/dashboard${date ? `?date=${date}` : ""}`}>
            โหลดใหม่
          </Link>
        }
      />
    );
  }

  const selected = resolveForecastDate(view.points, date);
  if (!selected) return <EmptyState title="ไม่มีข้อมูลพยากรณ์" />;
  const days = forecastDates(view.points)
    .map((d) => summarizeForecastDay(view.points, d))
    .filter((d): d is ForecastDaySummary => d !== null);
  const day = days.find((d) => d.date === selected) as ForecastDaySummary;
  const dayPoints = view.points.filter((p) => p.date === selected);
  const alerts = toRuleAlerts(view.points);
  const today = todayBangkok();
  const rank: Record<RiskLevel, number> = { normal: 0, warning: 1, high: 2 };
  const treeLevel = toRiskLevel(day.maxRisk);
  const level = rank[treeLevel] > rank[day.ruleLevel] ? treeLevel : day.ruleLevel;

  return (
    <>
      <Verdict
        dateLabel={`${formatThaiDate(selected)} (${daysAheadLabel(selected, today)})`}
        level={level}
        source={`จากพยากรณ์อากาศจริงรายชั่วโมง: ดัชนีสภาพอากาศสูงสุด ${day.maxSeverity.toFixed(2)} ติดเตือน ${day.alertHours} ชั่วโมง ความเสี่ยงจากโมเดล ${Math.round(day.maxRisk * 100)}%`}
      />
      <DayTabs days={days} selected={selected} />
      <ForecastSummary day={day} />
      {day.alertHours > 0 && day.maxRisk < 0.35 ? (
        <p className="callout">
          วันนี้โมเดล Decision Tree ให้ความเสี่ยงต่ำกว่าเกณฑ์ แต่กฎสภาพอากาศติดเตือน {day.alertHours} ชั่วโมง ในข้อมูลตัวอย่าง
          โมเดลยังไม่ดีกว่ากฎนี้ จึงควรให้น้ำหนักกับกฎมากกว่า
        </p>
      ) : null}
      {viewMode === "manager" ? (
        <>
      <section className="panel">
        <h2>ลมและฝนรายชั่วโมง (พยากรณ์)</h2>
        <WeatherChart hours={dayPoints.map((p) => ({ hour: p.hour, windKmh: p.windKmh, rainfallMm: p.rainMm }))} />
      </section>
      <section className="panel">
        <h2>คาดการณ์การใช้ไฟรายชั่วโมง</h2>
        <UsageForecastChart points={dayPoints.map((p) => ({ hour: p.hour, kwh: p.usageKwh }))} />
        <p className="muted">
          โมเดล “ค่าเฉลี่ยตามชั่วโมง + อุณหภูมิ” ที่ฝึกกับข้อมูลตัวอย่าง ใช้พยากรณ์ล่วงหน้าได้เพราะไม่ต้องรู้ค่าจริงของเมื่อวาน
        </p>
      </section>
      <section className="panel">
        <h2>ดัชนีสภาพอากาศรอบตัวคุณ 24 ชั่วโมง</h2>
        <Heatmap zones={zoneSeriesFromForecast(view.zones, selected, view.params)} />
      </section>
        </>
      ) : (
        <p className="muted">สลับเป็นมุมมองผู้ดูแลอาคารที่แถบเมนูด้านบนเพื่อดูกราฟลม/ฝน การใช้ไฟรายชั่วโมง และแผนที่ความร้อนรอบตัวคุณ</p>
      )}
      <section className="panel">
        <h2>แจ้งเตือน: ชั่วโมงที่ควรระวังใน {FORECAST_DAYS} วันข้างหน้า</h2>
        {alerts.length ? <AlertList alerts={alerts} scope={`${latitude},${longitude}`} /> : <EmptyState title={`ไม่มีชั่วโมงที่ติดเตือนใน ${FORECAST_DAYS} วันข้างหน้า`} hint="ดัชนีสภาพอากาศต่ำกว่าเกณฑ์ทุกชั่วโมง" />}
      </section>
      <p className="muted">{WEATHER_ATTRIBUTION}</p>
    </>
  );
}
