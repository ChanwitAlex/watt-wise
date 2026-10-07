import "server-only";
import { cache } from "react";
import { ANALOG_MIN_YEARS, ARCHIVE_API_URL, HISTORY_REVALIDATE_SEC, WEATHER_TIMEZONE } from "@/lib/config/weather";
import type { AnalogWindow } from "@/lib/analytics/climatology";
import type { ForecastHour } from "@/types/weather";
import { ForecastUnavailableError } from "./open-meteo";
import { parseHourly } from "./parse";
import { mapInChunks, retry } from "./retry";

const CONCURRENCY = 3; // ไม่ยิงทั้ง 10 ปีพร้อมกัน เพื่อไม่ชนข้อจำกัดอัตราเรียกของบริการฟรี
const TRIES = 3;
const RETRY_DELAY_MS = 800;

async function fetchWindow(latitude: number, longitude: number, w: AnalogWindow): Promise<ForecastHour[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: w.start,
    end_date: w.end,
    hourly: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m",
    timezone: WEATHER_TIMEZONE,
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  const url = `${process.env.ARCHIVE_API_URL ?? ARCHIVE_API_URL}?${params}`;
  return retry(
    async (attempt) => {
      // ครั้งแรกใช้แคช (สำเร็จแล้วเก็บไว้ 1 วัน) ครั้งที่ลองซ้ำไม่ใช้แคช และใส่หัว x-retry ให้ต่างจากครั้งแรก
      // เพราะ Next.js จะรวมคำขอ GET ที่เหมือนกันในการเรนเดอร์เดียวเป็นคำตอบเดียว ถ้าไม่ต่างกันจะได้ 429 เดิมซ้ำ
      const response = await fetch(url, attempt === 0 ? { next: { revalidate: HISTORY_REVALIDATE_SEC } } : { cache: "no-store", headers: { "x-retry": String(attempt) } });
      if (!response.ok) throw new Error(`archive ${response.status}`);
      const json = (await response.json()) as { hourly?: Parameters<typeof parseHourly>[0] };
      const hours = parseHourly(json.hourly);
      if (hours.length === 0) throw new Error("archive ไม่มีข้อมูล");
      return hours;
    },
    TRIES,
    RETRY_DELAY_MS,
  );
}

export interface AnalogHours {
  hours: ForecastHour[];
  loaded: number; // จำนวนปีที่ดึงสำเร็จ
  requested: number;
}

/** ดึงอากาศรายชั่วโมงของช่วงเทียบเคียงทุกปี (ทีละ 3 ปี ลองซ้ำเมื่อล้ม แคช 1 วัน) ต้องสำเร็จอย่างน้อย ANALOG_MIN_YEARS ปี */
export const loadAnalogHours = cache(async (latitude: number, longitude: number, key: string, windows: AnalogWindow[]): Promise<AnalogHours> => {
  void key; // key (วันที่เป้าหมาย) ใช้แยกแคชของ React ต่อคำขอ
  const results = await mapInChunks(windows, CONCURRENCY, (w) => fetchWindow(latitude, longitude, w));
  const ok = results.filter((r): r is PromiseFulfilledResult<ForecastHour[]> => r.status === "fulfilled");
  if (ok.length < ANALOG_MIN_YEARS) {
    throw new ForecastUnavailableError(`ดึงข้อมูลอากาศย้อนหลังได้เพียง ${ok.length} จาก ${windows.length} ปี (ต้องการอย่างน้อย ${ANALOG_MIN_YEARS})`);
  }
  return { hours: ok.flatMap((r) => r.value), loaded: ok.length, requested: windows.length };
});
