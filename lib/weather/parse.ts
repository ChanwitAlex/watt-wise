import type { ForecastHour } from "@/types/weather";

interface HourlyBlock {
  time?: string[];
  temperature_2m?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
  precipitation?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
}

/** แปลงคำตอบของ Open-Meteo (หนึ่งจุด) เป็นรายชั่วโมง ข้ามชั่วโมงที่ค่าไม่ครบ */
export function parseHourly(hourly: HourlyBlock | undefined): ForecastHour[] {
  if (!hourly?.time) return [];
  const out: ForecastHour[] = [];
  hourly.time.forEach((t, i) => {
    const temp = hourly.temperature_2m?.[i];
    const hum = hourly.relative_humidity_2m?.[i];
    const rain = hourly.precipitation?.[i];
    const wind = hourly.wind_speed_10m?.[i];
    const gust = hourly.wind_gusts_10m?.[i];
    if ([temp, hum, rain, wind].some((v) => typeof v !== "number")) return; // ลมกระโชกไม่บังคับ (บางช่วงเวลาในอดีตไม่มีค่า)
    out.push({
      timestamp: t.replace("T", " "),
      date: t.slice(0, 10),
      hour: Number(t.slice(11, 13)),
      tempC: temp as number,
      humidityPercent: hum as number,
      rainMm: rain as number,
      windKmh: wind as number,
      gustKmh: typeof gust === "number" ? gust : (wind as number),
    });
  });
  return out;
}

/** คำตอบจากหลายจุดเป็น array หนึ่งจุดเป็น object เดี่ยว ให้คืนเป็น array เสมอ */
export function parseForecastResponse(json: unknown, expectedCount: number): ForecastHour[][] {
  const items = Array.isArray(json) ? json : [json];
  if (items.length !== expectedCount) {
    throw new Error(`จำนวนจุดพยากรณ์ไม่ตรง: ได้ ${items.length} ต้องการ ${expectedCount}`);
  }
  return items.map((item) => parseHourly((item as { hourly?: HourlyBlock }).hourly));
}
