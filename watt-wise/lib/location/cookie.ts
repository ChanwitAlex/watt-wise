import { DEFAULT_PROVINCE } from "@/lib/config/location";
import { findProvince, isInThailand, nearestProvince, roundCoord } from "./geo";

export type LocationSource = "device" | "province" | "ip" | "default";

export interface UserLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
  province: string; // จังหวัดที่ใกล้ที่สุด
  label: string;
}

export function buildLocation(latitude: number, longitude: number, source: LocationSource): UserLocation {
  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);
  const province = nearestProvince({ latitude: lat, longitude: lon }).province.name;
  const labels: Record<LocationSource, string> = {
    device: `ตำแหน่งของคุณ (ใกล้ จ.${province})`,
    province: `จ.${province}`,
    ip: `ประมาณจากที่อยู่ IP (ใกล้ จ.${province})`,
    default: `ค่าเริ่มต้น จ.${province}`,
  };
  return { latitude: lat, longitude: lon, source, province, label: labels[source] };
}

export function defaultLocation(): UserLocation {
  const p = findProvince(DEFAULT_PROVINCE) ?? { lat: 13.7563, lon: 100.5018 };
  return buildLocation(p.lat, p.lon, "default");
}

export function serializeLocation(latitude: number, longitude: number, source: "device" | "province"): string {
  return `${roundCoord(latitude)},${roundCoord(longitude)},${source}`;
}

/** อ่านค่าจากคุกกี้ ถ้ารูปแบบผิดหรือนอกประเทศไทยให้คืน null (ผู้ใช้แก้คุกกี้เองได้ จึงต้องตรวจเสมอ) */
export function parseLocationCookie(value: string | undefined): UserLocation | null {
  if (!value) return null;
  const [lat, lon, source] = value.split(",");
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (source !== "device" && source !== "province") return null;
  if (!isInThailand(latitude, longitude)) return null;
  return buildLocation(latitude, longitude, source);
}

/** อ่านตำแหน่งจากหัว HTTP ของ Vercel (x-vercel-ip-*) ใช้เมื่อยังไม่เคยเลือกตำแหน่ง */
export function locationFromIpHeaders(h: { country?: string | null; latitude?: string | null; longitude?: string | null }): UserLocation | null {
  if (h.country !== "TH") return null;
  const latitude = Number(h.latitude);
  const longitude = Number(h.longitude);
  if (!isInThailand(latitude, longitude)) return null;
  return buildLocation(latitude, longitude, "ip");
}
