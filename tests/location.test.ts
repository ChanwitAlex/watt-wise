import { describe, expect, it } from "vitest";
import { PROVINCES } from "@/lib/config/provinces";
import { locationFromIpHeaders, parseLocationCookie, serializeLocation } from "@/lib/location/cookie";
import { findProvince, haversineKm, isInThailand, nearestProvince, roundCoord, surroundingLocations } from "@/lib/location/geo";

describe("provinces", () => {
  it("มี 77 จังหวัด ชื่อไม่ซ้ำ และพิกัดอยู่ในประเทศไทย", () => {
    expect(PROVINCES).toHaveLength(77);
    expect(new Set(PROVINCES.map((p) => p.name)).size).toBe(77);
    for (const p of PROVINCES) expect(isInThailand(p.lat, p.lon)).toBe(true);
  });
});

describe("geo", () => {
  it("หาจังหวัดที่ใกล้ที่สุด", () => {
    expect(nearestProvince({ latitude: 16.46, longitude: 102.82 }).province.name).toBe("ขอนแก่น");
    expect(nearestProvince({ latitude: 7.9, longitude: 98.4 }).province.name).toBe("ภูเก็ต");
  });
  it("haversine: ขอนแก่น–กรุงเทพ ราว 380 กม.", () => {
    const kk = findProvince("ขอนแก่น")!;
    const bkk = findProvince("กรุงเทพมหานคร")!;
    const d = haversineKm({ latitude: kk.lat, longitude: kk.lon }, { latitude: bkk.lat, longitude: bkk.lon });
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(420);
  });
  it("ปฏิเสธพิกัดนอกประเทศและค่าที่ไม่ใช่ตัวเลข", () => {
    expect(isInThailand(35.68, 139.69)).toBe(false); // โตเกียว
    expect(isInThailand(1.35, 103.82)).toBe(false); // สิงคโปร์
    expect(isInThailand(Number.NaN, 100)).toBe(false);
  });
  it("ปัดพิกัด ~1 กม.", () => {
    expect(roundCoord(16.441937)).toBe(16.44);
  });
  it("จุดรอบตัว 5 จุด id ไม่ซ้ำ", () => {
    const pts = surroundingLocations({ latitude: 16.44, longitude: 102.83 });
    expect(pts).toHaveLength(5);
    expect(new Set(pts.map((p) => p.id)).size).toBe(5);
    expect(pts[0]).toMatchObject({ id: "center", latitude: 16.44, longitude: 102.83 });
    expect(pts[1].latitude).toBeCloseTo(16.69, 2);
  });
});

describe("cookie / ip", () => {
  it("serialize แล้ว parse กลับได้", () => {
    const loc = parseLocationCookie(serializeLocation(16.4419, 102.835, "device"));
    expect(loc).toMatchObject({ latitude: 16.44, longitude: 102.84, source: "device", province: "ขอนแก่น" });
  });
  it("คุกกี้ที่ถูกแก้ให้ผิดรูปแบบหรือนอกประเทศถูกปฏิเสธ", () => {
    expect(parseLocationCookie(undefined)).toBeNull();
    expect(parseLocationCookie("abc,def,device")).toBeNull();
    expect(parseLocationCookie("35.68,139.69,device")).toBeNull();
    expect(parseLocationCookie("16.44,102.83,hacker")).toBeNull();
  });
  it("ใช้ตำแหน่งจาก IP เฉพาะประเทศไทย", () => {
    expect(locationFromIpHeaders({ country: "TH", latitude: "16.44", longitude: "102.83" })?.source).toBe("ip");
    expect(locationFromIpHeaders({ country: "US", latitude: "16.44", longitude: "102.83" })).toBeNull();
    expect(locationFromIpHeaders({ country: "TH", latitude: null, longitude: null })).toBeNull();
  });
});
