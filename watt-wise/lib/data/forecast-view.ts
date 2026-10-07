import "server-only";
import { buildForecastPoints, type ForecastPoint } from "@/lib/analytics/forecast";
import { CENTER_ZONE_ID } from "@/lib/config/weather";
import { ForecastUnavailableError, loadForecasts, type LocationForecast } from "@/lib/weather/open-meteo";
import type { ModelParams } from "@/types/model-params";
import { loadModelParams } from "./model-params";

export interface ForecastView {
  points: ForecastPoint[]; // จุดของผู้ใช้ พร้อมผลคำนวณของโมเดล
  zones: LocationForecast[]; // จุดผู้ใช้ + 4 ทิศ สำหรับแผนที่ความร้อน
  params: ModelParams;
}

/** รวมพยากรณ์อากาศกับพารามิเตอร์โมเดล (ส่งต่อให้ analytics คำนวณ ไม่ตัดสินใจเอง) */
export async function loadForecastView(latitude: number, longitude: number): Promise<ForecastView> {
  const [zones, params] = await Promise.all([loadForecasts(latitude, longitude), loadModelParams()]);
  const primary = zones.find((z) => z.locationId === CENTER_ZONE_ID);
  if (!primary || primary.hours.length === 0) throw new ForecastUnavailableError("ไม่มีข้อมูลพยากรณ์ของจุดหลัก");
  return { points: buildForecastPoints(primary.hours, params), zones, params };
}
