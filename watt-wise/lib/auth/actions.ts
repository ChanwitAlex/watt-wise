"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { DEMO_VIEW, VIEWS, type ViewMode } from "@/lib/config/site";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import { endSession, startSession } from "./session";
import { EmailTakenError, StoreNotConfiguredError, getUserStore } from "./user-store";
import { normalizeEmail, validateRegistration } from "./validation";
import { setView } from "./view";

export interface FormState {
  error: string | null;
}

const NOT_CONFIGURED =
  "ระบบสมาชิกยังไม่พร้อม (ยังไม่ได้ตั้งค่า DATABASE_URL บนเซิร์ฟเวอร์) ลองใช้ปุ่ม “ทดลองใช้โดยไม่ต้องสมัคร” ก่อน";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = validateRegistration({ name: text(form, "name"), email: text(form, "email"), password: text(form, "password") });
  if (!parsed.ok) return { error: parsed.error };
  const { name, email, password } = parsed.value;
  try {
    const store = getUserStore();
    const id = randomUUID();
    await store.create({ id, email, name, passwordHash: await hashPassword(password) });
    await startSession({ userId: id, name, demo: false });
  } catch (error) {
    if (error instanceof EmailTakenError) return { error: "อีเมลนี้ถูกใช้สมัครแล้ว" };
    if (error instanceof StoreNotConfiguredError) return { error: NOT_CONFIGURED };
    console.error("register failed", error);
    return { error: "สมัครสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(text(form, "email"));
  const password = text(form, "password");
  if (!email || !password) return { error: "กรอกอีเมลและรหัสผ่าน" };
  try {
    const user = await getUserStore().findByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    await startSession({ userId: user.id, name: user.name, demo: false });
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) return { error: NOT_CONFIGURED };
    console.error("login failed", error);
    return { error: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  redirect("/dashboard");
}

/** บัญชีทดลองสำหรับผู้ตรวจ ไม่ต้องสมัครและไม่ใช้ฐานข้อมูล */
export async function demoLoginAction(): Promise<void> {
  if (process.env.DEMO_ENABLED === "false") redirect("/login");
  await startSession({ userId: "demo", name: "ผู้ทดลองใช้", demo: true });
  await setView(DEMO_VIEW);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function switchViewAction(form: FormData): Promise<void> {
  const view = text(form, "view");
  if ((VIEWS as readonly string[]).includes(view)) await setView(view as ViewMode);
  const back = text(form, "back");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/dashboard");
}
