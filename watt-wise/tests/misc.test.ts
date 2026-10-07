import { describe, expect, it } from "vitest";
import { validateRegistration } from "@/lib/auth/validation";
import { linePath, linearScale, niceMax } from "@/lib/chart/scale";


describe("validateRegistration", () => {
  it("รับข้อมูลถูกต้องและแปลงอีเมลเป็นตัวพิมพ์เล็ก", () => {
    const r = validateRegistration({ name: " สมชาย ", email: "Somchai@Example.COM ", password: "12345678" });
    expect(r).toEqual({ ok: true, value: { name: "สมชาย", email: "somchai@example.com", password: "12345678" } });
  });
  it("ปฏิเสธข้อมูลไม่ถูกต้อง", () => {
    expect(validateRegistration({ name: "ก", email: "a@b.co", password: "12345678" }).ok).toBe(false);
    expect(validateRegistration({ name: "สมชาย", email: "ไม่ใช่อีเมล", password: "12345678" }).ok).toBe(false);
    expect(validateRegistration({ name: "สมชาย", email: "a@b.co", password: "1234567" }).ok).toBe(false);
  });
});


describe("chart helpers", () => {
  it("linearScale แปลงช่วง", () => {
    expect(linearScale([0, 10], [0, 100])(5)).toBe(50);
  });
  it("niceMax ปัดขึ้นเป็นเลขกลม", () => {
    expect(niceMax(3.58)).toBe(5);
    expect(niceMax(0)).toBe(1);
  });
  it("linePath เริ่มเส้นใหม่หลังช่องว่าง", () => {
    expect(linePath([{ x: 0, y: 0 }, null, { x: 1, y: 1 }])).toBe("M0.0 0.0M1.0 1.0");
  });
});

