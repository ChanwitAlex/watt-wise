import { MAX_DISTANCE_TO_PROVINCE_KM, THAILAND_BOUNDS } from "@/lib/config/location";
import { PROVINCES, type Province } from "@/lib/config/provinces";
import { CENTER_ZONE_ID, ZONE_OFFSET_DEG } from "@/lib/config/weather";
import type { WeatherLocation } from "@/types/weather";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100; // ≈ 1 กม. ไม่เก็บตำแหน่งละเอียดกว่านี้
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestProvince(point: Coordinates): { province: Province; distanceKm: number } {
  let best = PROVINCES[0];
  let bestDistance = Infinity;
  for (const p of PROVINCES) {
    const d = haversineKm(point, { latitude: p.lat, longitude: p.lon });
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return { province: best, distanceKm: bestDistance };
}

/** ค่าพิกัดต้องเป็นตัวเลขจริง อยู่ในกรอบประเทศไทย และใกล้ตัวเมืองของจังหวัดใดจังหวัดหนึ่ง */
export function isInThailand(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const b = THAILAND_BOUNDS;
  if (latitude < b.minLat || latitude > b.maxLat || longitude < b.minLon || longitude > b.maxLon) return false;
  return nearestProvince({ latitude, longitude }).distanceKm <= MAX_DISTANCE_TO_PROVINCE_KM;
}

export function findProvince(name: string): Province | undefined {
  return PROVINCES.find((p) => p.name === name);
}

/** จุดผู้ใช้ + 4 ทิศ (ห่าง ~28 กม.) สำหรับแผนที่ความร้อนรอบตัว */
export function surroundingLocations(center: Coordinates): WeatherLocation[] {
  const d = ZONE_OFFSET_DEG;
  const make = (id: string, name: string, dLat: number, dLon: number): WeatherLocation => ({
    id,
    name,
    latitude: roundCoord(center.latitude + dLat),
    longitude: roundCoord(center.longitude + dLon),
  });
  return [
    make(CENTER_ZONE_ID, "จุดของคุณ", 0, 0),
    make("north", "ทิศเหนือ (~28 กม.)", d, 0),
    make("south", "ทิศใต้ (~28 กม.)", -d, 0),
    make("east", "ทิศตะวันออก (~28 กม.)", 0, d),
    make("west", "ทิศตะวันตก (~28 กม.)", 0, -d),
  ];
}
