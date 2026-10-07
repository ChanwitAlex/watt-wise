import { describe, expect, it } from "vitest";
import params from "@/data/model_params.json";
import {
  analogWindows, analyzeAnalogDays, breakdownByYear, climatologyLevel, daysAheadLabel, percentile, summarizeAnalogs,
} from "@/lib/analytics/climatology";
import { addDays, addYears, clampTarget, diffDays, isValidDate, predictionMode, todayBangkok } from "@/lib/analytics/dates";
import type { ModelParams } from "@/types/model-params";
import type { ForecastHour } from "@/types/weather";

const p = params as unknown as ModelParams;

describe("dates", () => {
  it("วันนี้ตามเวลาไทย (UTC+7) ข้ามเที่ยงคืนถูกต้อง", () => {
    expect(todayBangkok(new Date("2026-10-06T16:59:00Z"))).toBe("2026-10-06");
    expect(todayBangkok(new Date("2026-10-06T17:00:00Z"))).toBe("2026-10-07");
  });
  it("บวกวัน/ปี และต่างวัน", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addYears("2026-10-06", 5)).toBe("2031-10-06");
    expect(diffDays("2026-10-06", "2026-10-22")).toBe(16);
  });
  it("ตรวจรูปแบบวันที่", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
  });
  it("เลือกโหมด: ภายใน 16 วันใช้พยากรณ์ ไกลกว่านั้นใช้สถิติ", () => {
    expect(predictionMode("2026-10-06", "2026-10-06", 16)).toBe("forecast");
    expect(predictionMode("2026-10-21", "2026-10-06", 16)).toBe("forecast"); // 15 วันข้างหน้า
    expect(predictionMode("2026-10-22", "2026-10-06", 16)).toBe("climatology");
    expect(predictionMode("2030-01-01", "2026-10-06", 16)).toBe("climatology");
  });
  it("บังคับวันที่ให้อยู่ในช่วง และบอกว่าถูกปรับ", () => {
    const t = "2026-10-06";
    expect(clampTarget("2026-12-25", t, 5)).toEqual({ date: "2026-12-25", adjusted: false });
    expect(clampTarget("2020-01-01", t, 5)).toEqual({ date: t, adjusted: true });
    expect(clampTarget("2040-01-01", t, 5)).toEqual({ date: "2031-10-06", adjusted: true });
    expect(clampTarget("abc", t, 5)).toEqual({ date: t, adjusted: true });
    expect(clampTarget(undefined, t, 5)).toEqual({ date: t, adjusted: false });
  });
});

describe("analogWindows", () => {
  it("ได้ 10 ปีย้อนหลัง ช่วง ±7 วัน และไม่รวมช่วงที่ข้อมูลยังไม่พร้อม", () => {
    const w = analogWindows("2027-03-15", "2026-10-06");
    expect(w).toHaveLength(10);
    expect(w[0]).toEqual({ year: 2026, start: "2026-03-08", end: "2026-03-22" });
    expect(w[9].year).toBe(2017);
  });
  it("วันเป้าหมายในปีนี้ที่ช่วงยังไม่ผ่านมา ข้ามปีนั้น", () => {
    const w = analogWindows("2026-11-20", "2026-10-06");
    expect(w[0].year).toBe(2025);
    expect(w.every((x) => x.end < "2026-09-29")).toBe(true);
  });
  it("29 กุมภาพันธ์ในปีไม่อธิกสุรทินไม่ทำให้พัง", () => {
    const w = analogWindows("2028-02-29", "2026-10-06");
    expect(w[0].year).toBe(2026); // ก.พ. 2027 ยังมาไม่ถึง จึงเริ่มจากปี 2026
    expect(w).toHaveLength(10);
    expect(w[0].start < w[0].end).toBe(true);
  });
});

function hoursOf(date: string, wind: number, rain: number): ForecastHour[] {
  return Array.from({ length: 24 }, (_, h) => ({
    timestamp: `${date} ${String(h).padStart(2, "0")}:00`, date, hour: h, tempC: 28, humidityPercent: 70, rainMm: rain, windKmh: wind, gustKmh: wind * 1.5,
  }));
}

describe("analyzeAnalogDays / summarizeAnalogs", () => {
  const hours = [...hoursOf("2020-03-10", 10, 0), ...hoursOf("2021-03-10", 60, 0), ...hoursOf("2022-03-10", 5, 40), ...hoursOf("2023-03-10", 12, 0)];
  const days = analyzeAnalogDays(hours, p, "2027-03-15");
  it("วิเคราะห์รายวัน: ลมแรง/ฝนหนักติดเตือน วันปกติไม่ติด", () => {
    expect(days).toHaveLength(4);
    expect(days.find((d) => d.date === "2020-03-10")?.alertHours).toBe(0);
    expect(days.find((d) => d.date === "2021-03-10")?.alertHours).toBe(24);
    expect(days.find((d) => d.date === "2022-03-10")?.maxSeverity).toBeGreaterThan(0.35);
  });
  it("ข้ามวันที่ข้อมูลไม่ครบ", () => {
    expect(analyzeAnalogDays(hoursOf("2020-03-10", 10, 0).slice(0, 10), p, "2027-03-15")).toEqual([]);
  });
  it("สรุปสัดส่วนวันที่ติดเตือน = 2 จาก 4", () => {
    const s = summarizeAnalogs(days)!;
    expect(s.n).toBe(4);
    expect(s.years).toBe(4);
    expect(s.shareAlert).toBe(0.5);
    expect(s.meanKwh).toBeGreaterThan(0);
    expect(s.kwhP10).toBeLessThanOrEqual(s.kwhP90);
  });
  it("ไม่มีวันให้สรุปได้ null", () => {
    expect(summarizeAnalogs([])).toBeNull();
  });
  it("แจกแจงรายปี เรียงปีล่าสุดก่อน", () => {
    const b = breakdownByYear(days);
    expect(b.map((y) => y.year)).toEqual([2023, 2022, 2021, 2020]);
    expect(b.find((y) => y.year === 2021)).toMatchObject({ alertDays: 1, days: 1 });
  });
});

describe("ระดับและข้อความ", () => {
  it("แปลงสัดส่วนเป็นระดับตามเกณฑ์ที่กำหนด", () => {
    expect(climatologyLevel(0)).toBe("normal");
    expect(climatologyLevel(0.049)).toBe("normal");
    expect(climatologyLevel(0.05)).toBe("warning");
    expect(climatologyLevel(0.2)).toBe("high");
  });
  it("percentile", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2], 0.5)).toBe(1.5);
    expect(percentile([], 0.5)).toBeNaN();
  });
  it("ข้อความระยะเวลา", () => {
    expect(daysAheadLabel("2026-10-06", "2026-10-06")).toBe("วันนี้");
    expect(daysAheadLabel("2026-10-07", "2026-10-06")).toBe("พรุ่งนี้");
    expect(daysAheadLabel("2026-10-20", "2026-10-06")).toBe("อีก 14 วัน");
    expect(daysAheadLabel("2027-04-06", "2026-10-06")).toBe("อีกประมาณ 6 เดือน");
    expect(daysAheadLabel("2031-10-06", "2026-10-06")).toContain("ปี");
  });
});
