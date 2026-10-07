import "server-only";
import { cookies, headers } from "next/headers";
import { LOCATION_COOKIE } from "@/lib/config/location";
import { defaultLocation, locationFromIpHeaders, parseLocationCookie, type UserLocation } from "./cookie";

/** ตำแหน่งที่ใช้ดึงพยากรณ์: คุกกี้ที่ผู้ใช้เลือก > ตำแหน่งจาก IP (บน Vercel) > ค่าเริ่มต้น */
export async function getLocation(): Promise<UserLocation> {
  const store = await cookies();
  const chosen = parseLocationCookie(store.get(LOCATION_COOKIE)?.value);
  if (chosen) return chosen;
  const h = await headers();
  return (
    locationFromIpHeaders({
      country: h.get("x-vercel-ip-country"),
      latitude: h.get("x-vercel-ip-latitude"),
      longitude: h.get("x-vercel-ip-longitude"),
    }) ?? defaultLocation()
  );
}
