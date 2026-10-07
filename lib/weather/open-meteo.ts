import "server-only";
import { cache } from "react";
import { FORECAST_DAYS, FORECAST_REVALIDATE_SEC, WEATHER_API_URL, WEATHER_TIMEZONE } from "@/lib/config/weather";
import { surroundingLocations } from "@/lib/location/geo";
import type { ForecastHour } from "@/types/weather";
import { parseForecastResponse } from "./parse";
import { retry } from "./retry";

export class ForecastUnavailableError extends Error {}

export interface LocationForecast {
  locationId: string;
  name: string;
  hours: ForecastHour[];
}

/** ดึงพยากรณ์ 7 วันของจุดผู้ใช้และอีก 4 ทิศในคำขอเดียว (หน่วย km/h และ mm) แคชไว้ 30 นาที */
export const loadForecasts = cache(async (latitude: number, longitude: number): Promise<LocationForecast[]> => {
  const locations = surroundingLocations({ latitude, longitude });
  const params = new URLSearchParams({
    latitude: locations.map((l) => l.latitude).join(","),
    longitude: locations.map((l) => l.longitude).join(","),
    hourly: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m",
    forecast_days: String(FORECAST_DAYS),
    timezone: WEATHER_TIMEZONE,
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  const url = `${process.env.WEATHER_API_URL ?? WEATHER_API_URL}?${params}`;
  let json: unknown;
  try {
    json = await retry(async (attempt) => {
      const response = await fetch(url, attempt === 0 ? { next: { revalidate: FORECAST_REVALIDATE_SEC } } : { cache: "no-store", headers: { "x-retry": String(attempt) } });
      if (!response.ok) throw new Error(`forecast ${response.status}`);
      return response.json();
    }, 2, 600);
  } catch (error) {
    throw new ForecastUnavailableError(error instanceof Error && error.message.startsWith("forecast ") ? `บริการพยากรณ์อากาศตอบกลับ ${error.message.slice(9)}` : "เชื่อมต่อบริการพยากรณ์อากาศไม่ได้");
  }
  let perLocation: ForecastHour[][];
  try {
    perLocation = parseForecastResponse(json, locations.length);
  } catch {
    throw new ForecastUnavailableError("อ่านข้อมูลพยากรณ์อากาศไม่ได้");
  }
  return locations.map((loc, i) => ({ locationId: loc.id, name: loc.name, hours: perLocation[i] }));
});
