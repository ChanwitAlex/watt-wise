import { describe, expect, it } from "vitest";
import fixture from "./fixtures/open-meteo-two-points.json";
import params from "@/data/model_params.json";
import { toRuleAlerts } from "@/lib/analytics/advice";
import { buildForecastPoints, isOffDay, summarizeForecastDay } from "@/lib/analytics/forecast";
import { evalTree, predictDurationMin, predictUsageKwh, severityOf } from "@/lib/analytics/inference";
import { parseForecastResponse, parseHourly } from "@/lib/weather/parse";
import type { ModelParams } from "@/types/model-params";

const p = params as unknown as ModelParams;

describe("parseForecastResponse", () => {
  it("แปลงหลายจุด และข้ามชั่วโมงที่มีค่า null", () => {
    const [a, b] = parseForecastResponse(fixture, 2);
    expect(a).toHaveLength(2); // ชั่วโมงที่ 02:00 มี temperature เป็น null จึงถูกข้าม
    expect(a[1]).toMatchObject({ timestamp: "2026-10-06 01:00", date: "2026-10-06", hour: 1, rainMm: 1.2, gustKmh: 16 });
    expect(b).toHaveLength(1);
  });
  it("ลมกระโชกเป็น null ยังใช้ชั่วโมงนั้นได้ (ใช้ค่าลมแทน)", () => {
    const h = parseHourly({ time: ["2020-01-01T00:00"], temperature_2m: [25], relative_humidity_2m: [80], precipitation: [0], wind_speed_10m: [7], wind_gusts_10m: [null] });
    expect(h).toHaveLength(1);
    expect(h[0].gustKmh).toBe(7);
  });
  it("จุดเดียวที่ตอบเป็น object ก็รับได้", () => {
    expect(parseForecastResponse(fixture[1], 1)[0]).toHaveLength(1);
  });
  it("จำนวนจุดไม่ตรงให้ error", () => {
    expect(() => parseForecastResponse(fixture, 5)).toThrow();
  });
  it("ไม่มี hourly ได้ลิสต์ว่าง", () => {
    expect(parseHourly(undefined)).toEqual([]);
  });
});

describe("evalTree", () => {
  // ต้นไม้เล็กที่เขียนเอง: ไม่ผูกกับผลเทรนครั้งใดครั้งหนึ่ง
  const tiny = [
    { leaf: false, feature: "wind_speed_kmh", threshold: 40, left: 1, right: 2, prob: 0.05 },
    { leaf: true, feature: null, threshold: null, left: null, right: null, prob: 0.02 },
    { leaf: false, feature: "hour", threshold: 18, left: 3, right: 4, prob: 0.4 },
    { leaf: true, feature: null, threshold: null, left: null, right: null, prob: 0.3 },
    { leaf: true, feature: null, threshold: null, left: null, right: null, prob: 0.7 },
  ];
  it("เดินตามกติกา ≤ threshold ไปซ้าย", () => {
    expect(evalTree(tiny, { wind_speed_kmh: 40, hour: 20 })).toBe(0.02); // เท่ากับ threshold ไปซ้าย
    expect(evalTree(tiny, { wind_speed_kmh: 41, hour: 18 })).toBe(0.3);
    expect(evalTree(tiny, { wind_speed_kmh: 41, hour: 19 })).toBe(0.7);
  });
  it("ขาดฟีเจอร์ให้ error", () => {
    expect(() => evalTree(tiny, { hour: 5 })).toThrow();
  });
  it("ต้นไม้ที่ส่งออกจริงมีโครงสร้างถูกต้อง และตอบความน่าจะเป็น 0-1 ได้ทุกอินพุต", () => {
    const nodes = p.outage_tree.nodes;
    nodes.forEach((n, i) => {
      expect(n.prob).toBeGreaterThanOrEqual(0);
      expect(n.prob).toBeLessThanOrEqual(1);
      if (!n.leaf) {
        expect(p.outage_tree.features).toContain(n.feature);
        expect(n.left as number).toBeGreaterThan(i);
        expect(n.right as number).toBeGreaterThan(i);
      }
    });
    for (const hour of [0, 12, 20]) {
      for (const wind of [0, 30, 70]) {
        const prob = evalTree(nodes, { hour, is_weekend: 0, wind_speed_kmh: wind, rainfall_mm: wind / 3, wind_gust_kmh: wind * 2, is_holiday: 0 });
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("โมเดลอื่น", () => {
  it("severity ใกล้เคียง ลม/120 + ฝน/80 และจำกัดที่ 1", () => {
    expect(severityOf(p, 60, 0)).toBeCloseTo(0.5, 2);
    expect(severityOf(p, 0, 40)).toBeCloseTo(0.5, 2);
    expect(severityOf(p, 500, 500)).toBe(1);
  });
  it("ระยะเวลาไม่ต่ำกว่า 1 นาที และเพิ่มตามฝน", () => {
    const feats = { hour: 12, wind_speed_kmh: 10, rainfall_mm: 0 };
    expect(predictDurationMin(p, feats)).toBeGreaterThanOrEqual(1);
    expect(predictDurationMin(p, { ...feats, rainfall_mm: 20 })).toBeGreaterThan(predictDurationMin(p, feats));
  });
  it("ใช้ไฟเพิ่มเมื่ออากาศร้อนกว่าปกติ", () => {
    const cool = predictUsageKwh(p, { isOffDay: false, hour: 15, tempC: 25 });
    const hot = predictUsageKwh(p, { isOffDay: false, hour: 15, tempC: 36 });
    expect(hot).toBeGreaterThan(cool);
  });
});

describe("buildForecastPoints / summarizeForecastDay", () => {
  const hours = parseHourly((fixture[0] as { hourly: never }).hourly);
  const points = buildForecastPoints(hours, p);
  it("คำนวณครบทุกช่อง", () => {
    for (const pt of points) {
      expect(pt.riskProb).toBeGreaterThanOrEqual(0);
      expect(pt.usageKwh).toBeGreaterThan(0);
      expect(pt.severity).toBeGreaterThanOrEqual(0);
    }
  });
  it("สรุปรายวัน", () => {
    const s = summarizeForecastDay(points, "2026-10-06");
    expect(s?.totalRainMm).toBeCloseTo(1.2, 5);
    expect(s?.maxWindKmh).toBe(7.1);
    expect(summarizeForecastDay(points, "2030-01-01")).toBeNull();
  });
  it("เสาร์-อาทิตย์นับเป็นวันหยุด", () => {
    expect(isOffDay("2026-10-10")).toBe(true); // เสาร์
    expect(isOffDay("2026-10-12")).toBe(false); // จันทร์
  });
});

describe("toRuleAlerts", () => {
  const mk = (date: string, hour: number, wind: number, rain: number) => ({
    timestamp: `${date} ${String(hour).padStart(2, "0")}:00`, date, hour, tempC: 28, humidityPercent: 70, rainMm: rain, windKmh: wind, gustKmh: wind * 1.5,
  });
  const points = buildForecastPoints([mk("2026-10-08", 17, 60, 0), mk("2026-10-07", 15, 10, 0), mk("2026-10-07", 18, 5, 40)], p);
  it("เก็บเฉพาะชั่วโมงที่ถึงเกณฑ์ และเรียงตามเวลา", () => {
    const alerts = toRuleAlerts(points);
    expect(alerts.map((a) => a.timestamp)).toEqual(["2026-10-07 18:00", "2026-10-08 17:00"]);
    expect(alerts[0].advice.length).toBeGreaterThan(0);
  });
  it("ไม่มีชั่วโมงเสี่ยงได้ลิสต์ว่าง", () => {
    expect(toRuleAlerts(buildForecastPoints([mk("2026-10-07", 12, 8, 0)], p))).toEqual([]);
  });
});
