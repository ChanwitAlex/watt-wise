"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCATION_COOKIE, LOCATION_COOKIE_MAX_AGE_SEC } from "@/lib/config/location";
import { serializeLocation, type LocationSource } from "./cookie";
import { findProvince, isInThailand } from "./geo";

async function saveLocation(latitude: number, longitude: number, source: "device" | "province") {
  const store = await cookies();
  store.set(LOCATION_COOKIE, serializeLocation(latitude, longitude, source), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LOCATION_COOKIE_MAX_AGE_SEC,
  });
}

/** กลับไปหน้าที่ผู้ใช้อยู่ (ดูจาก Referer ถ้าเป็นเว็บเดียวกัน) */
async function backPath(): Promise<string> {
  const h = await headers();
  try {
    const ref = new URL(h.get("referer") ?? "");
    if (ref.host === h.get("host")) return `${ref.pathname}${ref.search}`;
  } catch {
    /* ไม่มี referer */
  }
  return "/dashboard";
}

/** เรียกจากเบราว์เซอร์หลังผู้ใช้อนุญาตตำแหน่ง (ไม่เก็บลงฐานข้อมูล เก็บในคุกกี้ปัดเศษ ~1 กม.) */
export async function setDeviceLocationAction(latitude: number, longitude: number): Promise<{ error: string | null }> {
  if (!isInThailand(latitude, longitude)) {
    return { error: "ตำแหน่งนี้อยู่นอกประเทศไทย ระบบรองรับเฉพาะพื้นที่ในประเทศไทย เลือกจังหวัดจากรายการแทนได้" };
  }
  await saveLocation(latitude, longitude, "device");
  return { error: null };
}

export async function selectProvinceAction(form: FormData): Promise<void> {
  const name = form.get("province");
  const province = typeof name === "string" ? findProvince(name) : undefined;
  if (province) await saveLocation(province.lat, province.lon, "province");
  redirect(await backPath());
}

export type { LocationSource };
