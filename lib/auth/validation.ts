import { PASSWORD_MIN_LENGTH } from "@/lib/config/site";

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
}

export type ValidationResult = { ok: true; value: RegistrationInput } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ตรวจข้อมูลสมัครสมาชิก (pure function ทดสอบได้โดยไม่ต้องมีเว็บ) */
export function validateRegistration(input: { name?: string; email?: string; password?: string }): ValidationResult {
  const name = (input.name ?? "").trim();
  const email = normalizeEmail(input.email ?? "");
  const password = input.password ?? "";
  if (name.length < 2) return { ok: false, error: "กรอกชื่ออย่างน้อย 2 ตัวอักษร" };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร` };
  }
  return { ok: true, value: { name, email, password } };
}
