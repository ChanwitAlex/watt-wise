import Link from "next/link";
import { AlertList } from "@/components/dashboard/AlertList";
import { EmptyState } from "@/components/ui/EmptyState";
import { toRuleAlerts } from "@/lib/analytics/advice";
import { RULE_SEVERITY_THRESHOLD } from "@/lib/config/risk";
import { FORECAST_DAYS, WEATHER_ATTRIBUTION } from "@/lib/config/weather";
import { loadForecastView } from "@/lib/data/forecast-view";
import { ForecastUnavailableError } from "@/lib/weather/open-meteo";

/** ชั่วโมงที่ควรระวังในพยากรณ์ล่วงหน้า (ตามกฎสภาพอากาศ) ของพื้นที่ผู้ใช้ */
export async function AlertsContent({ latitude, longitude }: { latitude: number; longitude: number }) {
  let alerts;
  try {
    alerts = toRuleAlerts((await loadForecastView(latitude, longitude)).points);
  } catch (error) {
    if (!(error instanceof ForecastUnavailableError)) throw error;
    return (
      <EmptyState
        title="ดึงพยากรณ์อากาศไม่สำเร็จ"
        hint={`${error.message} ลองโหลดหน้านี้ใหม่อีกครั้งในอีกสักครู่`}
        action={
          <Link className="btn btn--primary" href="/alerts">
            โหลดใหม่
          </Link>
        }
      />
    );
  }
  return (
    <>
      <p className="muted">
        เตือนเมื่อดัชนีสภาพอากาศ (ลม/120 + ฝน/80) ≥ {RULE_SEVERITY_THRESHOLD} ในพยากรณ์ {FORECAST_DAYS} วันข้างหน้า ข้อความทั้งหมดเป็นกฎ ไม่ได้มาจากโมเดล · พบ {alerts.length} ชั่วโมง เรียงจากใกล้สุด
      </p>
      {alerts.length ? (
        <AlertList alerts={alerts} scope={`${latitude},${longitude}`} />
      ) : (
        <EmptyState title={`ไม่มีชั่วโมงที่ติดเตือนใน ${FORECAST_DAYS} วันข้างหน้า`} hint="ดัชนีสภาพอากาศต่ำกว่าเกณฑ์ทุกชั่วโมง" />
      )}
      <p className="muted">{WEATHER_ATTRIBUTION}</p>
    </>
  );
}
